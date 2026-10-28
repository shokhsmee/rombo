"""Duplicates and merging, auto-assignment (distribution), bulk actions (uzbridge crm/extras.py + services.bulk).

Rombo leads often have only a phone (the client is made on conversion), so a duplicate is "another open lead
with the same number" — the lead's own phone or its client's — or the same client.
"""

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.chatter.models import Message
from apps.chatter.services import event
from apps.core.exceptions import Conflict, ValidationFailed
from apps.crm import phones
from apps.crm.models import Call, IntakeLog, Lead, LeadStatus, LeadTask, Stage
from apps.crm.services import live
from apps.crm.services.leads import clean_tags, crm_settings, lead_delete, lead_move, set_stage

DUP_LIMIT = 10

# ------------------------------------------------------------------ duplicates


def _key_of(lead) -> str:
    return phones.key(lead.phone) or phones.key(lead.client.phone if lead.client_id and lead.client else "")


def duplicate_keys() -> set[str]:
    """Phone keys (and client ids as 'c<id>') shared by more than one open lead — the board's «Dubl» badge."""
    seen: dict[str, int] = {}
    for phone, client_phone, client_id in Lead.objects.filter(status=LeadStatus.OPEN).values_list(
            "phone", "client__phone", "client_id"):
        for k in {phones.key(phone) or phones.key(client_phone), f"c{client_id}" if client_id else ""} - {""}:
            seen[k] = seen.get(k, 0) + 1
    return {k for k, n in seen.items() if n > 1}


def is_duplicate(lead, keys: set[str]) -> bool:
    return lead.status == LeadStatus.OPEN and (
        _key_of(lead) in keys or (lead.client_id is not None and f"c{lead.client_id}" in keys))


def _dup_out(ld: Lead) -> dict:
    return {"id": ld.pk, "code": ld.code, "title": ld.title, "pipeline": ld.pipeline.name, "stage": ld.stage.name,
            "stage_tone": ld.stage.tone, "manager": ld.manager.name if ld.manager else None,
            "created_at": ld.created_at}


def _open_by(key: str = "", client_ids=(), email: str = "", exclude: int | None = None) -> list[Lead]:
    q = Q(pk__in=[])
    if key:
        q |= Q(phone__endswith=key[-2:]) | Q(client__phone__endswith=key[-2:])
    if client_ids:
        q |= Q(client_id__in=list(client_ids))
    if email:
        q |= Q(client__email__iexact=email)
    qs = (Lead.objects.filter(status=LeadStatus.OPEN).filter(q).exclude(pk=exclude)
          .select_related("pipeline", "stage", "manager", "client").order_by("-updated_at", "-id"))
    out = []
    for ld in qs:
        if (key and _key_of(ld) == key) or (ld.client_id and ld.client_id in client_ids) or (
                email and ld.client_id and ld.client.email.lower() == email.lower()):
            out.append(ld)
        if len(out) >= DUP_LIMIT:
            break
    return out


def duplicates_of(lead: Lead) -> list[dict]:
    if not crm_settings().duplicates_enabled:
        return []
    key = _key_of(lead)
    if not key and not lead.client_id:
        return []
    return [_dup_out(ld) for ld in _open_by(key, {lead.client_id} - {None}, exclude=lead.pk)]


def duplicates_check(phone: str = "", email: str = "") -> list[dict]:
    """Open leads with this number / client email — the quick-add form warns before a duplicate is made."""
    key = phones.key(phone)
    if not key and not email:
        return []
    return [_dup_out(ld) for ld in _open_by(key, email=email.strip())]


@transaction.atomic
def lead_merge(lead: Lead, *, actor, into: Lead) -> Lead:
    """`lead` folds into `into`: tasks, calls, history, tags, budget, notes, custom values; `lead` is closed as
    a duplicate (not deleted: links to it keep working)."""
    if into.pk == lead.pk:
        raise ValidationFailed("O'ziga birlashtirib bo'lmaydi", field="into")
    lead, into = (Lead.objects.select_for_update().get(pk=x.pk) for x in (lead, into))
    if into.status != LeadStatus.OPEN:
        raise Conflict("Yopilgan lidga birlashtirib bo'lmaydi")
    if lead.project_id:
        raise Conflict("Liddan loyiha ochilgan — uni birlashtirib bo'lmaydi")
    LeadTask.objects.filter(lead=lead).update(lead=into)
    Call.objects.filter(lead=lead).update(lead=into)
    IntakeLog.objects.filter(lead=lead).update(lead=into)
    Message.objects.filter(model="crm.lead", res_id=lead.pk).update(res_id=into.pk)
    into.tags = clean_tags([*(into.tags or []), *(lead.tags or [])])
    into.budget = max(into.budget, lead.budget)
    if lead.notes.strip():
        into.notes = (into.notes + "\n\n" + lead.notes).strip()
    into.custom = {**(lead.custom or {}), **(into.custom or {})}
    into.client = into.client or lead.client
    into.phone = into.phone or lead.phone
    into.contact_name = into.contact_name or lead.contact_name
    into.stamp(actor)
    into.save()
    event(into, f"{lead.code} «{lead.title}» shu lidga birlashtirildi", actor=actor)
    lost = lead.pipeline.stages.filter(is_lost=True).first()
    if lost is not None:
        set_stage(lead, lost, actor=actor, lost_reason=f"Dubl: {into.code}")
    event(lead, f"{into.code} ga birlashtirildi (dubl)", actor=actor)
    live.board(into.pipeline_id)
    return into


# ------------------------------------------------------------------ distribution


def pick_manager():
    """The next manager for a lead nobody assigned: round robin, or the one with the fewest open leads (ties in
    queue order). None when distribution is off or nobody is in the queue."""
    from apps.crm.models import CrmSettings
    from apps.employees.models import Employee, EmployeeStatus

    crm_settings()
    with transaction.atomic():
        s = CrmSettings.objects.select_for_update().get(pk=1)
        if not s.distribution_enabled:
            return None
        active = set(Employee.objects.filter(pk__in=s.distribution_managers, status=EmployeeStatus.ACTIVE)
                     .values_list("pk", flat=True))
        queue = [i for i in s.distribution_managers if i in active]
        if not queue:
            return None
        if s.distribution_mode == "least_open":
            counts = dict(Lead.objects.filter(status=LeadStatus.OPEN, manager_id__in=queue)
                          .values_list("manager_id").annotate(n=Count("id")))
            low = min(counts.get(i, 0) for i in queue)
            queue = [i for i in queue if counts.get(i, 0) == low]
        pick = _after(queue, s.distribution_last)
        s.distribution_last = pick
        s.save(update_fields=["distribution_last"])
    return Employee.objects.get(pk=pick)


def _after(ids: list[int], last) -> int:
    if last in ids:
        return ids[(ids.index(last) + 1) % len(ids)]
    return ids[0]


# ------------------------------------------------------------------ bulk

BULK_LIMIT = 500


@transaction.atomic
def leads_bulk(*, actor, ids: list[int], action: str, stage: Stage | None = None, manager=None, tag: str = "",
               reason: str = "") -> int:
    leads = list(Lead.objects.filter(pk__in=ids[:BULK_LIMIT]).select_related("pipeline", "manager", "source"))
    if action == "move":
        if stage is None:
            raise ValidationFailed("Bosqichni tanlang", field="stage_id")
        if stage.is_lost and not reason.strip():
            raise ValidationFailed("Rad etish sababini yozing", field="reason")
        for ld in leads:
            if ld.pipeline_id == stage.pipeline_id:  # other pipelines' leads are skipped
                lead_move(ld, actor=actor, stage=stage, lost_reason=reason)
    elif action == "assign":
        for ld in leads:
            before = ld.manager_id
            ld.manager = manager
            ld.stamp(actor)
            ld.save()  # chatter tracks the manager
            if manager is not None and manager.pk != before:
                live.lead_assigned(ld, by=actor)
    elif action in ("tag", "untag"):
        t = (tag or "").strip()[:40]
        if not t:
            raise ValidationFailed("Tegni kiriting", field="tag")
        for ld in leads:
            tags = [x for x in ld.tags or [] if x != t] + ([t] if action == "tag" else [])
            Lead.objects.filter(pk=ld.pk).update(tags=clean_tags(tags), updated_at=timezone.now())
    elif action == "lost":
        if not reason.strip():
            raise ValidationFailed("Rad etish sababini yozing", field="reason")
        for ld in leads:
            lost = ld.pipeline.stages.filter(is_lost=True).first()
            if lost and ld.stage_id != lost.pk:
                lead_move(ld, actor=actor, stage=lost, lost_reason=reason)
    elif action == "delete":
        for ld in leads:
            if not ld.project_id:
                lead_delete(ld, actor=actor)
    else:
        raise ValidationFailed("Noma'lum amal", field="action")
    for pid in {ld.pipeline_id for ld in leads}:
        live.board(pid)
    return len(leads)
