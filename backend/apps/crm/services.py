"""CRM and telephony writes (ported from uzbridge crm/services.py, telephony.py, routing.py).

Leads become a Mijoz + Loyiha through the clients / projects services; those apps never import crm.
"""

import json
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.chatter.services import diff, event, muted, post
from apps.clients.models import ClientKind
from apps.clients.services import client_create
from apps.core.exceptions import Conflict, NotFound, ValidationFailed
from apps.core.models import assign_code
from apps.crm import phones, selectors
from apps.crm.models import (
    DEFAULT_LOST,
    DEFAULT_STAGES,
    DEFAULT_WON,
    LIVE_STATUSES,
    Call,
    CallDirection,
    CallStatus,
    Extension,
    Lead,
    LeadStatus,
    LeadTask,
    Pipeline,
    Stage,
    TaskKind,
    TelephonySettings,
    new_token,
)
from apps.crm.normalize import NormalCall, normalize
from apps.projects.services import project_create

# ------------------------------------------------------------------ pipelines and stages


@transaction.atomic
def pipeline_create(*, actor, name: str, is_default: bool = False, **fields) -> Pipeline:
    pos = (Pipeline.objects.aggregate(m=Max("position"))["m"] or 0) + 1
    if is_default:
        Pipeline.objects.update(is_default=False)
    p = Pipeline(name=name, position=pos, is_default=is_default, **fields)
    p.stamp(actor, created=True)
    p.save()
    for i, (n, tone, hint) in enumerate(DEFAULT_STAGES):
        Stage.objects.create(pipeline=p, name=n, tone=tone, hint=hint, position=i)
    Stage.objects.create(pipeline=p, name=DEFAULT_WON[0], tone=DEFAULT_WON[1], is_won=True, position=90)
    Stage.objects.create(pipeline=p, name=DEFAULT_LOST[0], tone=DEFAULT_LOST[1], is_lost=True, position=91)
    return p


@transaction.atomic
def pipeline_update(p: Pipeline, *, actor, **fields) -> Pipeline:
    if fields.get("is_default"):
        Pipeline.objects.exclude(pk=p.pk).update(is_default=False)
    for k, v in fields.items():
        setattr(p, k, v)
    p.stamp(actor)
    p.save()
    return p


def default_pipeline() -> Pipeline:
    """The pipeline new leads go to; made on first use."""
    p = Pipeline.objects.filter(is_active=True).order_by("-is_default", "position", "id").first()
    if p:
        return p
    with transaction.atomic():  # two first requests at once must not make two pipelines
        p = Pipeline.objects.select_for_update().filter(is_active=True).first()
        return p or pipeline_create(actor=None, name="Sotuv", is_default=True)


def _first_open_stage(p: Pipeline) -> Stage:
    st = p.stages.filter(is_won=False, is_lost=False).first()
    if st is None:
        raise Conflict(f"«{p.name}» voronkasida ochiq bosqich yo'q")
    return st


@transaction.atomic
def stage_create(*, actor, pipeline: Pipeline, name: str, **fields) -> Stage:
    # a new open stage goes after the open ones, before won / lost
    last = pipeline.stages.filter(is_won=False, is_lost=False).aggregate(m=Max("position"))["m"]
    fields.setdefault("position", (last if last is not None else -1) + 1)
    return Stage.objects.create(pipeline=pipeline, name=name, **fields)


def stage_update(stage: Stage, *, actor, **fields) -> Stage:
    for k, v in fields.items():
        setattr(stage, k, v)
    stage.save()
    return stage


def stage_delete(stage: Stage, *, actor) -> None:
    if Lead.all_objects.filter(stage=stage).exists():
        raise Conflict("Bosqichda lidlar bor — avval ularni boshqa bosqichga o'tkazing")
    if stage.is_won or stage.is_lost:
        same = stage.pipeline.stages.filter(is_won=stage.is_won, is_lost=stage.is_lost).exclude(pk=stage.pk)
        if not same.exists():
            raise Conflict("Voronkada «yutildi» va «rad etildi» bosqichlari qolishi kerak")
    elif not stage.pipeline.stages.filter(is_won=False, is_lost=False).exclude(pk=stage.pk).exists():
        raise Conflict("Voronkada kamida bitta ochiq bosqich qolishi kerak")
    stage.delete()


# ------------------------------------------------------------------ leads


def _employee_of(user):
    return getattr(user, "employee", None) if user is not None else None


def _status_of(stage: Stage) -> str:
    return LeadStatus.WON if stage.is_won else LeadStatus.LOST if stage.is_lost else LeadStatus.OPEN


@transaction.atomic
def lead_create(*, actor, pipeline: Pipeline | None = None, stage: Stage | None = None, **fields) -> Lead:
    if stage is not None:
        pipeline = stage.pipeline
    pipeline = pipeline or default_pipeline()
    stage = stage or _first_open_stage(pipeline)
    if stage.pipeline_id != pipeline.pk:
        raise ValidationFailed("Bosqich boshqa voronkada", field="stage_id")
    phone = phones.pretty(fields.pop("phone", "") or "")
    if not fields.get("client") and phone:
        fields["client"] = selectors.client_by_phone(phone)
    if not (fields.get("title") or "").strip():
        fields["title"] = fields.get("contact_name") or (fields["client"].name if fields.get("client") else "") or phone
    if not fields["title"]:
        raise ValidationFailed("Lid nomi, aloqa shaxsi yoki telefonni kiriting", field="title")
    lead = Lead(pipeline=pipeline, stage=stage, status=_status_of(stage), phone=phone, **fields)
    lead.stamp(actor, created=True)
    lead.save()  # chatter: "Lid yaratildi"
    assign_code(lead, "LD")
    return lead


@transaction.atomic
def lead_update(lead: Lead, *, actor, **fields) -> Lead:
    if "phone" in fields:
        fields["phone"] = phones.pretty(fields["phone"] or "")
        if not lead.client_id and not fields.get("client") and fields["phone"]:
            fields["client"] = selectors.client_by_phone(fields["phone"]) or fields.get("client")
    for k, v in fields.items():
        setattr(lead, k, v)
    lead.stamp(actor)
    lead.save()  # chatter tracks the changed fields
    return lead


def _set_stage(lead: Lead, stage: Stage, *, actor, comment: str = "", lost_reason: str = "") -> None:
    before = {"stage": lead.stage_id, "status": lead.status, "lost_reason": lead.lost_reason}
    lead.stage = stage
    lead.status = _status_of(stage)
    lead.lost_reason = lost_reason[:200] if stage.is_lost else ""
    lead.stage_changed_at = timezone.now()
    lead.stamp(actor)
    with muted():  # one history line (with the reason), not a bare tracked change + a note
        lead.save()
    post(lead, comment, kind="track", actor=actor,
         changes=diff(lead, before, {"stage": "Bosqich", "status": "Holat", "lost_reason": "Rad sababi"}))


@transaction.atomic
def lead_move(lead: Lead, *, actor, stage: Stage, lost_reason: str = "") -> Lead:
    lead = Lead.objects.select_for_update().get(pk=lead.pk)
    if stage.pipeline_id != lead.pipeline_id:
        raise ValidationFailed("Bosqich boshqa voronkada", field="stage_id")
    if stage.pk == lead.stage_id:
        return lead
    lost_reason = (lost_reason or "").strip()
    if stage.is_lost and not lost_reason:
        raise ValidationFailed("Rad etish sababini yozing", field="lost_reason")
    _set_stage(lead, stage, actor=actor, lost_reason=lost_reason)
    return lead


def lead_delete(lead: Lead, *, actor) -> None:
    if lead.project_id:
        raise Conflict("Liddan loyiha ochilgan — o'chirib bo'lmaydi")
    lead.soft_delete()


@transaction.atomic
def lead_convert(lead: Lead, *, actor, client=None, project_name: str = "") -> Lead:
    """Lead → Mijoz (existing or new) + Loyiha, the lead moves to the won stage."""
    lead = Lead.objects.select_for_update().select_related("client", "source", "manager").get(pk=lead.pk)
    if lead.project_id:
        raise Conflict("Bu liddan loyiha allaqachon ochilgan")
    client = client or lead.client or selectors.client_by_phone(lead.phone)
    if client is None:
        client = client_create(
            actor=actor, kind=ClientKind.INDIVIDUAL, name=(lead.contact_name or lead.title)[:255],
            phone=lead.phone, region=lead.region, address=lead.address, manager=lead.manager,
            source=lead.source.name if lead.source else "Lid",
        )
    project = project_create(
        actor=actor, name=(project_name or lead.title).strip()[:255], client=client, manager=lead.manager,
        phone=lead.phone or client.phone, region=lead.region or client.region, object_address=lead.address,
        sales_channel=lead.source, amount=lead.budget,
    )
    event(project, f"Liddan yaratildi: {lead.code} «{lead.title}»", actor=actor)
    won = lead.pipeline.stages.filter(is_won=True).first()
    before = {"client": lead.client_id, "project": lead.project_id}
    lead.client, lead.project = client, project
    if won is not None and won.pk != lead.stage_id:
        _set_stage(lead, won, actor=actor, comment=f"Loyiha ochildi: {project.code}")
    else:
        with muted():
            lead.save()
    changes = diff(lead, before, {"client": "Mijoz", "project": "Loyiha"})
    if changes:
        post(lead, kind="track", changes=changes, actor=actor)
    return lead


# ------------------------------------------------------------------ tasks


def _task_line(t: LeadTask) -> str:
    when = f" ({timezone.localtime(t.due_at):%d.%m %H:%M})" if t.due_at else ""
    return f"{TaskKind(t.kind).label}{' — ' + t.text if t.text else ''}{when}"


@transaction.atomic
def task_create(*, actor, lead: Lead, **fields) -> LeadTask:
    fields.setdefault("assignee", actor)
    t = LeadTask(lead=lead, **fields)
    t.stamp(actor, created=True)
    t.save()
    event(lead, f"Vazifa: {_task_line(t)}", actor=actor)
    return t


@transaction.atomic
def task_update(t: LeadTask, *, actor, **fields) -> LeadTask:
    was_done = t.done
    for k, v in fields.items():
        setattr(t, k, v)
    if t.done and not was_done:
        t.done_at = timezone.now()
    elif not t.done:
        t.done_at = None
    t.stamp(actor)
    t.save()
    if t.done != was_done:
        event(t.lead, f"Vazifa {'bajarildi' if t.done else 'qayta ochildi'}: {_task_line(t)}", actor=actor)
    return t


def task_delete(t: LeadTask, *, actor) -> None:
    lead, line = t.lead, _task_line(t)
    t.delete()
    event(lead, f"Vazifa o'chirildi: {line}", actor=actor)


# ------------------------------------------------------------------ telephony: settings and extensions

DIRECTION_TEXT = {"in": "Kiruvchi qo'ng'iroq", "out": "Chiquvchi qo'ng'iroq", "internal": "Ichki qo'ng'iroq"}
STATUS_TEXT = {"missed": "o'tkazib yuborildi", "no_answer": "javob berilmadi", "busy": "band", "failed": "ulanmadi"}
STALE_AFTER = timedelta(minutes=30)
SOFTPHONE_QUIET = timedelta(days=2)  # a PBX webhook this recent owns the call records


def telephony_settings() -> TelephonySettings:
    st, _ = TelephonySettings.objects.get_or_create(
        pk=1, defaults={"sip_wss": settings.TELEPHONY_SIP_WSS, "sip_domain": settings.TELEPHONY_SIP_DOMAIN})
    return st


def telephony_settings_update(*, actor, **fields) -> TelephonySettings:
    st = telephony_settings()
    if "sip_wss" in fields:
        wss = (fields["sip_wss"] or "").strip()
        if wss and not wss.startswith(("wss://", "ws://")):
            raise ValidationFailed("Manzil wss:// bilan boshlanishi kerak", field="sip_wss")
        fields["sip_wss"] = wss
    for k, v in fields.items():
        setattr(st, k, v)
    st.save()
    return st


def telephony_rotate_token(*, actor) -> TelephonySettings:
    st = telephony_settings()
    st.webhook_token = new_token()
    st.save(update_fields=["webhook_token", "updated_at"])
    return st


def extension_create(*, actor, **fields) -> Extension:
    _check_extension(fields.get("user"), fields.get("number"))
    return Extension.objects.create(**fields)


def extension_update(ext: Extension, *, actor, **fields) -> Extension:
    _check_extension(fields.get("user", ext.user), fields.get("number", ext.number), exclude=ext.pk)
    if fields.get("sip_password") in (None, ""):
        fields.pop("sip_password", None)  # write-only: an empty field keeps the saved one
    for k, v in fields.items():
        setattr(ext, k, v)
    ext.save()
    return ext


def _check_extension(user, number, exclude=None) -> None:
    qs = Extension.objects.exclude(pk=exclude)
    if user is not None and qs.filter(user=user).exists():
        raise Conflict("Bu foydalanuvchiga ichki raqam biriktirilgan", field="user_id")
    if number and qs.filter(number=number).exists():
        raise Conflict("Bu ichki raqam band", field="number")


def extension_delete(ext: Extension, *, actor) -> None:
    ext.delete()


# ------------------------------------------------------------------ telephony: calls


def fmt_duration(sec: int) -> str:
    return f"{sec // 60}:{sec % 60:02d}"


def call_text(call: Call) -> str:
    parts = [DIRECTION_TEXT.get(call.direction, "Qo'ng'iroq"), phones.pretty(call.client_phone)]
    parts.append(fmt_duration(call.duration) if call.status == CallStatus.ANSWERED else STATUS_TEXT.get(call.status, ""))
    return " · ".join(p for p in parts if p)


def _user_for_extension(number: str):
    ext = Extension.objects.filter(number__iexact=number).select_related("user").first() if number else None
    return ext.user if ext else None


def ingest(payload: dict, *, source: str = Call.Source.WEBHOOK, user=None) -> Call | None:
    """One PBX / softphone event: upsert the call; when it has ended, run the CRM rules once."""
    st = telephony_settings()
    own = [n for n in st.company_numbers.replace(";", ",").split(",") if n.strip()]
    nc = normalize(payload, company_numbers=own)
    if nc is None:
        return None
    for attempt in (1, 2):  # a PBX can send two events of one call at the same instant: one insert wins
        try:
            return _ingest(nc, st, source, user)
        except IntegrityError:
            if attempt == 2:
                raise
    return None


def _ingest(nc: NormalCall, st: TelephonySettings, source: str, user) -> Call:
    with transaction.atomic():
        call = Call.objects.select_for_update().filter(external_id=nc.external_id[:120]).first()
        if call is None:
            call = Call(external_id=nc.external_id[:120], source=source, started_at=nc.started_at or timezone.now())
        elif call.status not in LIVE_STATUSES and not nc.final:
            return call  # a late "ringing" after the end
        _apply(call, nc)
        if call.user_id is None:
            call.user = user or _user_for_extension(call.extension)
        if call.client_id is None and call.client_phone:
            call.client = selectors.client_by_phone(call.client_phone)
        if call.lead_id is None and call.client_phone:
            call.lead = selectors.open_lead_by_phone(call.client_phone)
        call.save()
        if source == Call.Source.WEBHOOK:
            TelephonySettings.objects.filter(pk=st.pk).update(last_event_at=timezone.now())
        if nc.final and not call.processed and call.direction != CallDirection.INTERNAL:
            apply_rules(call, st)
    return call


def _apply(call: Call, nc: NormalCall) -> None:
    if nc.direction_known or not call.pk:
        call.direction = nc.direction
    call.status = nc.status
    if not nc.direction_known and nc.final and call.direction == CallDirection.OUT and nc.status == CallStatus.MISSED:
        call.status = CallStatus.NO_ANSWER
    for f in ("from_number", "to_number", "client_phone", "extension", "recording_url"):
        v = getattr(nc, f)
        if v:
            setattr(call, f, v)
    if nc.started_at:
        call.started_at = nc.started_at
    if nc.duration:
        call.duration = nc.duration
    if nc.wait:
        call.wait = nc.wait
    if nc.status == CallStatus.TALKING and call.answered_at is None:
        call.answered_at = nc.answered_at or timezone.now()
    if nc.final:
        call.ended_at = nc.ended_at or call.ended_at or timezone.now()
        if not call.duration and call.answered_at and call.ended_at:
            call.duration = max(0, int((call.ended_at - call.answered_at).total_seconds()))
    raw = dict(call.raw or {})
    raw["events"] = ((raw.get("events") or []) + [nc.raw])[-8:]
    call.raw = json.loads(json.dumps(raw, default=str))


def _lead_from_call(call: Call, *, actor=None) -> Lead:
    lead = lead_create(actor=actor, title=f"Qo'ng'iroq: {phones.pretty(call.client_phone)}", phone=call.client_phone,
                       client=call.client, manager=_employee_of(call.user) or _employee_of(actor))
    event(lead, "Lid qo'ng'iroqdan yaratildi", actor=actor)
    return lead


def _log_call(call: Call) -> None:
    text = call_text(call)
    if call.lead_id:
        event(call.lead, text, actor=call.user)
    if call.client_id:
        event(call.client, text, actor=call.user)


def apply_rules(call: Call, st: TelephonySettings | None = None) -> None:
    """An ended call goes into the CRM: lead linked / created, history lines, a call-back task when missed."""
    st = st or telephony_settings()
    call.processed = True
    if call.lead_id is None and call.client_phone and call.direction == CallDirection.IN:
        create = st.missed_creates_lead if call.status == CallStatus.MISSED else st.incoming_creates_lead
        if create:
            call.lead, call.created_lead = _lead_from_call(call), True
    call.save()
    _log_call(call)
    lead = call.lead
    if lead is None:
        return
    callbacks = lead.tasks.filter(done=False, call__isnull=False)
    if call.status == CallStatus.ANSWERED:
        # they got through (or we called back): the open call-back tasks are done
        for t in callbacks:
            t.done, t.done_at = True, timezone.now()
            t.save(update_fields=["done", "done_at", "updated_at"])
            event(lead, f"Vazifa bajarildi: {_task_line(t)}", actor=call.user)
    elif call.status == CallStatus.MISSED and st.missed_task and not callbacks.exists():
        manager_user = lead.manager.user if lead.manager_id and lead.manager.user_id else None
        t = LeadTask.objects.create(
            lead=lead, kind=TaskKind.CALL, call=call, assignee=call.user or manager_user,
            text=f"Qayta qo'ng'iroq qilish: {phones.pretty(call.client_phone)}",
            due_at=timezone.now() + timedelta(minutes=st.missed_task_minutes),
        )
        event(lead, f"Vazifa: {_task_line(t)}")
    Lead.objects.filter(pk=lead.pk).update(updated_at=timezone.now())


def expire_stale() -> None:
    """A PBX that never sent the end: after 30 min a ringing call counts as missed, a live talk as done."""
    for c in Call.objects.filter(status__in=LIVE_STATUSES, started_at__lt=timezone.now() - STALE_AFTER):
        c.status = (CallStatus.ANSWERED if c.status == CallStatus.TALKING
                    else CallStatus.MISSED if c.direction == CallDirection.IN else CallStatus.NO_ANSWER)
        c.ended_at = c.ended_at or c.started_at
        if not c.processed and c.direction != CallDirection.INTERNAL:
            apply_rules(c)
        else:
            c.save()


@transaction.atomic
def call_update(call: Call, *, actor, note: str | None = None, lead: Lead | None = None) -> Call:
    if note is not None:
        call.note = note[:2000]
    if lead is not None and lead.pk != call.lead_id:
        call.lead, call.processed = lead, True
        call.client = call.client or lead.client
        event(lead, call_text(call), actor=call.user or actor)
    call.save()
    return call


@transaction.atomic
def call_create_lead(call: Call, *, actor) -> Call:
    if call.lead_id:
        raise Conflict("Qo'ng'iroq lidga bog'langan")
    if not call.client_phone:
        raise ValidationFailed("Raqam yo'q — lid yaratib bo'lmaydi")
    lead = _lead_from_call(call, actor=actor)
    call.lead, call.created_lead, call.processed = lead, True, True
    call.save()
    event(lead, call_text(call), actor=call.user or actor)
    return call


def softphone_report(*, actor, data: dict) -> Call | None:
    """The browser phone reports its own calls like a PBX would — only while no PBX webhook is live
    (the PBX's record is the one; a second would duplicate it)."""
    st = telephony_settings()
    if st.last_event_at and st.last_event_at >= timezone.now() - SOFTPHONE_QUIET:
        return None
    ext = Extension.objects.filter(user=actor).first()
    if ext is None:
        raise NotFound("Sizga ichki raqam biriktirilmagan")
    payload = {k: v for k, v in data.items() if k in ("call_id", "event", "direction", "from", "to", "billsec")}
    payload["extension"] = ext.number
    payload["call_id"] = f"sp-{actor.pk}-{payload.get('call_id', '')}"
    call = ingest(payload, source=Call.Source.SOFTPHONE, user=actor)
    if call is None:
        raise ValidationFailed("Qo'ng'iroq ma'lumoti yetarli emas")
    return call
