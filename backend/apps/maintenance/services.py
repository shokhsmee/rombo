"""Every write of the Servis module. The ERP views, the bots and the Mini Apps all come through here.

`actor` is the ERP user (or None when a bot user acts); `by` is the history line's author for bot actions
("Usta: Ali Valiyev", "Mijoz: …"). Notifications go out after commit (notify.py) and never break a write.
"""

from pathlib import Path

from django.db import transaction
from django.utils import timezone

from apps.chatter.services import diff, muted, post
from apps.clients.models import Client
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.models import assign_code
from apps.crm import phones
from apps.maintenance import notify
from apps.maintenance.models import (
    MASTER_ACTIVE_STATUSES,
    TRANSITIONS,
    Master,
    PhotoStage,
    RequestSource,
    RequestStatus,
    ServicePhoto,
    ServiceRequest,
)

S = RequestStatus

# ------------------------------------------------------------------ masters


def _check_master_phone(phone: str, exclude_id: int | None = None) -> str:
    k = phones.key(phone)
    if not k:
        raise ValidationFailed("Telefon raqamini to'liq kiriting", field="phone")
    others = Master.objects.filter(phone__endswith=k[-2:])
    if exclude_id:
        others = others.exclude(pk=exclude_id)
    if any(phones.key(m.phone) == k for m in others.only("phone")):
        raise Conflict("Bu telefon bilan usta mavjud", field="phone")
    return phones.normalize(phone)


@transaction.atomic
def master_create(*, actor, **fields) -> Master:
    fields["phone"] = _check_master_phone(fields.get("phone", ""))
    master = Master(**fields)
    master.stamp(actor, created=True)
    master.save()
    assign_code(master, "US", width=4)
    return master


@transaction.atomic
def master_update(master: Master, *, actor, **fields) -> Master:
    if "phone" in fields:
        fields["phone"] = _check_master_phone(fields["phone"], exclude_id=master.pk)
    busy = master.requests.filter(status__in=MASTER_ACTIVE_STATUSES)
    if fields.get("is_active") is False and busy.exists():
        raise Conflict("Ustada ochiq ishlar bor — avval ularni boshqa ustaga bering")
    for key, value in fields.items():
        setattr(master, key, value)
    master.stamp(actor)
    master.save()
    if "phone" in fields:  # the old Telegram link was for the old number
        master.bot_users.exclude(phone="").exclude(phone__endswith=phones.key(master.phone)).update(master=None)
    return master


def master_delete(master: Master, *, actor) -> None:
    if master.requests.exists():
        raise Conflict("Ustaning arizalari bor — o'chirish o'rniga nofaol qiling")
    master.bot_users.update(master=None)
    master.soft_delete()


def master_by_phone(raw: str) -> Master | None:
    k = phones.key(raw)
    if not k:
        return None
    for m in Master.objects.filter(is_active=True, phone__endswith=k[-2:]):
        if phones.key(m.phone) == k:
            return m
    return None


# ------------------------------------------------------------------ requests

EDITABLE_FIELDS = {"client", "project", "kind", "description", "phone", "address", "latitude", "longitude",
                   "preferred_date", "is_warranty", "price"}


def _check_project(fields: dict, client: Client) -> None:
    project = fields.get("project")
    if project is not None and project.client_id != client.pk:
        raise ValidationFailed("Loyiha boshqa mijozniki", field="project_id")


def _check_point(lat, lng) -> None:
    if (lat is None) != (lng is None):
        raise ValidationFailed("Nuqta uchun kenglik va uzunlik ikkalasi kerak", field="latitude")


@transaction.atomic
def request_create(*, actor, source: str = RequestSource.ERP, photos=(), **fields) -> ServiceRequest:
    client: Client = fields["client"]
    _check_project(fields, client)
    _check_point(fields.get("latitude"), fields.get("longitude"))
    if not (fields.get("description") or "").strip():
        raise ValidationFailed("Muammoni yozing", field="description")
    project = fields.get("project")
    fields.setdefault("phone", client.phone)
    if not fields.get("address"):
        fields["address"] = (project.object_address if project else "") or client.address
    if project is not None and "is_warranty" not in fields:
        fields["is_warranty"] = True  # our own installation: warranty unless the operator says otherwise
    req = ServiceRequest(source=source, **fields)
    req.stamp(actor, created=True)
    req.save()  # chatter: "Servis arizasi yaratildi"
    req.code = f"SV-{timezone.localdate():%y}-{req.pk:05d}"
    req.save(update_fields=["code"])
    for upload in photos:
        photo_add(req, upload=upload, stage=PhotoStage.BEFORE)
    notify.request_created(req)
    return req


@transaction.atomic
def request_update(req: ServiceRequest, *, actor, **fields) -> ServiceRequest:
    unknown = set(fields) - EDITABLE_FIELDS
    assert not unknown, f"not editable here: {unknown}"
    if req.status in (S.CLOSED, S.CANCELLED):
        raise Conflict("Yopilgan arizani o'zgartirib bo'lmaydi")
    client = fields.get("client", req.client)
    if "client" in fields and "project" not in fields and req.project and req.project.client_id != client.pk:
        fields["project"] = None
    _check_project({"project": fields.get("project", req.project)}, client)
    _check_point(fields.get("latitude", req.latitude), fields.get("longitude", req.longitude))
    for key, value in fields.items():
        setattr(req, key, value)
    req.stamp(actor)
    req.save()
    return req


def request_delete(req: ServiceRequest, *, actor) -> None:
    if req.status != S.NEW:
        raise Conflict("Faqat yangi arizani o'chirish mumkin. Boshqalarini bekor qiling.")
    req.soft_delete()


def _locked(req: ServiceRequest) -> ServiceRequest:
    # two people (operator + master) pressing at once must not both pass the transition check
    qs = ServiceRequest.objects.select_for_update(of=("self",)).select_related("master", "client")
    return qs.get(pk=req.pk)


def _move(req: ServiceRequest, status: str, *, actor=None, by: str = "", comment: str = "",
          extra: dict | None = None) -> ServiceRequest:
    """The one place a status changes: checks TRANSITIONS, stamps times, writes one history line."""
    current = req.status
    if status not in TRANSITIONS[current]:
        raise ValidationFailed(
            f"'{S(current).label}' holatidan '{S(status).label}' holatiga o'tib bo'lmaydi", field="status")
    now = timezone.now()
    before = {"status": current, "master": req.master_id, "scheduled_at": req.scheduled_at}
    fields = {"status": status, **(extra or {})}
    if status == S.NEW:
        fields.update(master=None, assigned_at=None, scheduled_at=None)
    elif status == S.ASSIGNED:
        fields["assigned_at"] = now
    elif status == S.IN_PROGRESS and not req.started_at:
        fields["started_at"] = now
    elif status == S.DONE:
        fields["done_at"] = now
    elif status in (S.CLOSED, S.CANCELLED):
        fields["closed_at"] = now
    for k, v in fields.items():
        setattr(req, k, v)
    req.stamp(actor)
    with muted():  # one history line with the comment, not a bare tracked change + a separate note
        req.save(update_fields=[*fields, "updated_by", "updated_at"])
    body = f"{by}: {comment}" if by and comment else (by or comment)
    post(req, body, kind="track", changes=diff(req, before, {"status": "Holat", "master": "Usta",
                                                                "scheduled_at": "Vaqt"}), actor=actor)
    return req


@transaction.atomic
def request_assign(req: ServiceRequest, *, actor, master: Master, scheduled_at=None) -> ServiceRequest:
    """Give the job to a master (or to another one). The master gets it in the bot with accept / decline."""
    req = _locked(req)
    if not master.is_active:
        raise ValidationFailed("Usta nofaol", field="master_id")
    if req.status not in (S.NEW, S.ASSIGNED, S.ACCEPTED):
        raise Conflict(f"'{S(req.status).label}' holatidagi arizaga usta biriktirib bo'lmaydi")
    previous = req.master if req.master_id and req.master_id != master.pk else None
    if req.status != S.NEW:
        if previous is None and scheduled_at == req.scheduled_at:
            return req  # same master, same time: nothing to send again
        with muted():
            req.status = S.NEW  # re-assign = back to the pool and out again, in one history line
    req = _move(req, S.ASSIGNED, actor=actor, extra={"master": master, "scheduled_at": scheduled_at})
    if previous is not None:
        notify.master_removed(req, previous)
    notify.assigned(req)
    return req


@transaction.atomic
def request_change_status(req: ServiceRequest, *, actor, status: str, comment: str = "") -> ServiceRequest:
    """Operator moves from the ERP. Assigning goes through request_assign (it needs a master)."""
    req = _locked(req)
    comment = comment.strip()
    if status == S.ASSIGNED:
        raise ValidationFailed("Usta biriktirish uchun 'Ustaga berish' tugmasidan foydalaning",
                               field="status")
    if status == S.CANCELLED and not comment:
        raise ValidationFailed("Bekor qilish sababini yozing", field="comment")
    old_master = req.master
    old_status = req.status
    extra = {"cancel_reason": comment[:500]} if status == S.CANCELLED else None
    req = _move(req, status, actor=actor, comment=comment, extra=extra)
    if old_master and status in (S.NEW, S.CANCELLED) and old_status in MASTER_ACTIVE_STATUSES:
        notify.master_removed(req, old_master)
    notify.status_changed(req, old_status)
    return req


# ------------------------------------------------------------------ the master, from the bot / Mini App


def _master_job(req: ServiceRequest, master: Master) -> ServiceRequest:
    req = _locked(req)
    if req.master_id != master.pk:
        raise Conflict("Bu ish sizga biriktirilmagan")
    return req


@transaction.atomic
def master_accept(req: ServiceRequest, *, master: Master) -> ServiceRequest:
    req = _master_job(req, master)
    if req.status == S.ACCEPTED:
        return req  # pressed twice
    req = _move(req, S.ACCEPTED, by=f"Usta {master.name}", comment="qabul qildi")
    notify.status_changed(req, S.ASSIGNED)
    return req


@transaction.atomic
def master_decline(req: ServiceRequest, *, master: Master, reason: str = "") -> ServiceRequest:
    req = _master_job(req, master)
    if req.status not in (S.ASSIGNED, S.ACCEPTED):
        raise Conflict("Boshlangan ishni rad etib bo'lmaydi — ofisga qo'ng'iroq qiling")
    reason = reason.strip()
    req = _move(req, S.NEW, by=f"Usta {master.name}", comment=f"rad etdi{': ' + reason if reason else ''}")
    notify.master_declined(req, master, reason)
    return req


@transaction.atomic
def master_start(req: ServiceRequest, *, master: Master) -> ServiceRequest:
    req = _master_job(req, master)
    if req.status == S.IN_PROGRESS:
        return req
    if req.status == S.ASSIGNED:  # started without pressing "accept" first
        req = _move(req, S.ACCEPTED, by=f"Usta {master.name}", comment="qabul qildi")
    old = req.status
    req = _move(req, S.IN_PROGRESS, by=f"Usta {master.name}", comment="ishni boshladi")
    notify.status_changed(req, old)
    return req


@transaction.atomic
def master_finish(req: ServiceRequest, *, master: Master, report: str, photos=()) -> ServiceRequest:
    req = _master_job(req, master)
    report = report.strip()
    if not report:
        raise ValidationFailed("Nima qilinganini yozing", field="report")
    if req.status != S.IN_PROGRESS:
        raise Conflict("Avval ishni boshlang")
    for upload in photos:
        photo_add(req, upload=upload, stage=PhotoStage.AFTER)
    req = _move(req, S.DONE, by=f"Usta {master.name}", comment=report, extra={"report": report})
    notify.status_changed(req, S.IN_PROGRESS)
    return req


# ------------------------------------------------------------------ the client, from the bot / Mini App


def _client_request(req: ServiceRequest, client: Client) -> ServiceRequest:
    req = _locked(req)
    if req.client_id != client.pk:
        raise Conflict("Ariza topilmadi")
    return req


@transaction.atomic
def client_cancel(req: ServiceRequest, *, client: Client, reason: str = "") -> ServiceRequest:
    req = _client_request(req, client)
    if req.status not in (S.NEW, S.ASSIGNED, S.ACCEPTED):
        raise Conflict("Usta ishni boshlagan — bekor qilish uchun ofisga qo'ng'iroq qiling")
    old_master, old = req.master, req.status
    reason = reason.strip() or "mijoz bekor qildi"
    req = _move(req, S.CANCELLED, by=f"Mijoz {client.name}", comment=reason,
                extra={"cancel_reason": reason[:500]})
    if old_master:
        notify.master_removed(req, old_master)
    notify.status_changed(req, old)
    return req


@transaction.atomic
def client_rate(req: ServiceRequest, *, client: Client, rating: int, feedback: str = "") -> ServiceRequest:
    """The client confirms the job is done: closes the request with a 1–5 rating."""
    req = _client_request(req, client)
    if not 1 <= rating <= 5:
        raise ValidationFailed("Baho 1 dan 5 gacha", field="rating")
    if req.status != S.DONE:
        raise Conflict("Faqat bajarilgan ishni baholash mumkin")
    feedback = feedback.strip()
    req = _move(req, S.CLOSED, by=f"Mijoz {client.name}", comment=f"{'★' * rating} {feedback}".strip(),
                extra={"rating": rating, "feedback": feedback})
    notify.rated(req)
    return req


@transaction.atomic
def client_reopen(req: ServiceRequest, *, client: Client, comment: str) -> ServiceRequest:
    """'Not fixed': back to the same master, in progress."""
    req = _client_request(req, client)
    comment = comment.strip()
    if not comment:
        raise ValidationFailed("Nima hal bo'lmaganini yozing", field="comment")
    if req.status != S.DONE:
        raise Conflict("Faqat bajarilgan ishni qayta ochish mumkin")
    req = _move(req, S.IN_PROGRESS, by=f"Mijoz {client.name}", comment=f"hal bo'lmadi: {comment}")
    notify.reopened(req, comment)
    return req


# ------------------------------------------------------------------ photos

PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
MAX_PHOTO_BYTES = 10 * 1024 * 1024
MAX_PHOTOS = 10


def photo_add(req: ServiceRequest, *, upload, stage: str = PhotoStage.BEFORE) -> ServicePhoto:
    ext = Path(upload.name).suffix.lower()
    if ext not in PHOTO_EXT:
        raise ValidationFailed("Faqat rasm: jpg, png, webp, heic", field="photos")
    if upload.size > MAX_PHOTO_BYTES:
        raise ValidationFailed("Rasm 10 MB dan katta", field="photos")
    if req.photos.count() >= MAX_PHOTOS * 2:
        raise ValidationFailed("Rasmlar juda ko'p", field="photos")
    return ServicePhoto.objects.create(request=req, stage=stage, file=upload)


def photo_delete(photo: ServicePhoto, *, actor) -> None:
    photo.file.delete(save=False)
    photo.delete()
