"""Pipelines, stages, lost reasons, lead fields, CRM settings, leads, tasks and conversion
(uzbridge crm/services.py + the settings endpoints of crm/api.py)."""

import re
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.chatter.services import diff, event, muted, post
from apps.clients.models import ClientKind
from apps.clients.services import client_create
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.models import assign_code
from apps.crm import phones, selectors
from apps.crm.models import (
    DEFAULT_CARD_FIELDS,
    DEFAULT_LOST,
    DEFAULT_STAGES,
    DEFAULT_TASK_TYPES,
    DEFAULT_WON,
    LOST_REASONS,
    ClientData,
    CrmSettings,
    Lead,
    LeadField,
    LeadStatus,
    LeadTask,
    LostReason,
    Pipeline,
    Stage,
)
from apps.crm.services import live
from apps.projects.services import project_create

# ------------------------------------------------------------------ settings


def crm_settings() -> CrmSettings:
    s, _ = CrmSettings.objects.get_or_create(
        pk=1, defaults={"task_types": DEFAULT_TASK_TYPES, "card_fields": DEFAULT_CARD_FIELDS})
    return s


def crm_settings_update(*, actor, **fields) -> CrmSettings:
    s = crm_settings()
    if "task_types" in fields:
        types = [str(t).strip()[:40] for t in fields["task_types"] or [] if str(t).strip()]
        fields["task_types"] = list(dict.fromkeys(types))[:20]
        if not fields["task_types"]:
            raise ValidationFailed("Kamida bitta vazifa turi bo'lsin", field="task_types")
    if "card_fields" in fields:
        fields["card_fields"] = [str(k)[:50] for k in fields["card_fields"] or []][:16]
    if "distribution_managers" in fields:
        from apps.employees.models import Employee

        ids = [int(x) for x in fields["distribution_managers"] or []]
        alive = set(Employee.objects.filter(pk__in=ids).values_list("pk", flat=True))
        fields["distribution_managers"] = [i for i in dict.fromkeys(ids) if i in alive]
    for k, v in fields.items():
        setattr(s, k, v)
    s.save()
    live.board()
    return s


# ------------------------------------------------------------------ pipelines and stages


@transaction.atomic
def pipeline_create(*, actor, name: str, is_default: bool = False, **fields) -> Pipeline:
    pos = (Pipeline.objects.aggregate(m=Max("position"))["m"] or 0) + 1
    if is_default:
        Pipeline.objects.update(is_default=False)
    p = Pipeline(name=(name or "Voronka")[:100], position=pos, is_default=is_default, **fields)
    p.stamp(actor, created=True)
    p.save()
    for i, (n, tone, hint) in enumerate(DEFAULT_STAGES):
        Stage.objects.create(pipeline=p, name=n, tone=tone, hint=hint, position=i)
    Stage.objects.create(pipeline=p, name=DEFAULT_WON[0], tone=DEFAULT_WON[1], is_won=True, position=90)
    Stage.objects.create(pipeline=p, name=DEFAULT_LOST[0], tone=DEFAULT_LOST[1], is_lost=True, position=91)
    LostReason.objects.bulk_create(LostReason(pipeline=p, text=t, position=i) for i, t in enumerate(LOST_REASONS))
    return p


@transaction.atomic
def pipeline_update(p: Pipeline, *, actor, **fields) -> Pipeline:
    if fields.get("is_active") is False and p.is_active:
        if not Pipeline.objects.filter(is_active=True).exclude(pk=p.pk).exists():
            raise Conflict("Oxirgi faol voronkani arxivlab bo'lmaydi", field="is_active")
        if p.is_default:
            fields["is_default"] = False
    if fields.get("is_default"):
        Pipeline.objects.exclude(pk=p.pk).update(is_default=False)
    for k, v in fields.items():
        setattr(p, k, v)
    p.stamp(actor)
    p.save()
    if not Pipeline.objects.filter(is_default=True, is_active=True).exists():
        first = Pipeline.objects.filter(is_active=True).order_by("position", "id").first()
        if first:
            Pipeline.objects.filter(pk=first.pk).update(is_default=True)
    live.board(p.pk)
    return p


def default_pipeline() -> Pipeline:
    """The pipeline new leads go to; made on first use."""
    p = Pipeline.objects.filter(is_active=True).order_by("-is_default", "position", "id").first()
    if p:
        return p
    with transaction.atomic():  # two first requests at once must not make two pipelines
        p = Pipeline.objects.select_for_update().filter(is_active=True).first()
        return p or pipeline_create(actor=None, name="Sotuv", is_default=True)


def first_open_stage(p: Pipeline) -> Stage:
    st = p.stages.filter(is_won=False, is_lost=False).first()
    if st is None:
        raise Conflict(f"«{p.name}» voronkasida ochiq bosqich yo'q")
    return st


@transaction.atomic
def stage_create(*, actor, pipeline: Pipeline, name: str, **fields) -> Stage:
    # a new open stage goes after the open ones, before won / lost
    last = pipeline.stages.filter(is_won=False, is_lost=False).aggregate(m=Max("position"))["m"]
    fields.setdefault("position", (last if last is not None else -1) + 1)
    st = Stage.objects.create(pipeline=pipeline, name=name, **fields)
    live.board(pipeline.pk)
    return st


def stage_update(stage: Stage, *, actor, **fields) -> Stage:
    if "position" in fields and (stage.is_won or stage.is_lost):
        fields.pop("position")  # terminal stages stay at the end
    if "position" in fields:
        fields["position"] = max(0, min(80, int(fields["position"])))
    for k, v in fields.items():
        setattr(stage, k, v)
    stage.save()
    live.board(stage.pipeline_id)
    return stage


@transaction.atomic
def stages_reorder(pipeline: Pipeline, *, actor, ids: list[int]) -> None:
    """Work stages in the given order (won / lost keep their place)."""
    work = {s.pk: s for s in pipeline.stages.filter(is_won=False, is_lost=False)}
    for i, pk in enumerate(x for x in ids if x in work):
        Stage.objects.filter(pk=pk).update(position=i)
    live.board(pipeline.pk)


def stage_delete(stage: Stage, *, actor) -> None:
    if Lead.all_objects.filter(stage=stage).exists():
        raise Conflict("Bosqichda lidlar bor — avval ularni boshqa bosqichga o'tkazing")
    if stage.is_won or stage.is_lost:
        raise Conflict("Voronkada «yutildi» va «rad etildi» bosqichlari qolishi kerak")
    if not stage.pipeline.stages.filter(is_won=False, is_lost=False).exclude(pk=stage.pk).exists():
        raise Conflict("Voronkada kamida bitta ochiq bosqich qolishi kerak")
    pid = stage.pipeline_id
    stage.delete()
    live.board(pid)


def lost_reason_create(*, actor, pipeline: Pipeline, text: str) -> LostReason:
    text = (text or "").strip()[:120]
    if not text:
        raise ValidationFailed("Sababni yozing", field="text")
    return LostReason.objects.create(pipeline=pipeline, text=text, position=pipeline.lost_reasons.count())


def lost_reason_delete(r: LostReason, *, actor) -> None:
    r.delete()


# ------------------------------------------------------------------ lead fields


def _field_key(label: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", re.sub(r"[ʻʼ'`’]", " ", label.lower())).strip("_")[:30] or "field"
    key, n = base, 2
    while LeadField.objects.filter(key=key).exists():
        key, n = f"{base}_{n}", n + 1
    return key


def _options(opts) -> list[str]:
    return [str(o).strip()[:60] for o in opts or [] if str(o).strip()][:50]


def field_create(*, actor, label: str, type: str = "text", section: str = "extra", options=None) -> LeadField:
    label = (label or "").strip()[:80]
    if not label:
        raise ValidationFailed("Maydon nomini yozing", field="label")
    return LeadField.objects.create(
        key=_field_key(label), label=label,
        type=type if type in LeadField.Type.values else LeadField.Type.TEXT,
        section=section if section in LeadField.Section.values else LeadField.Section.EXTRA,
        options=_options(options), position=LeadField.objects.count())


def field_update(fd: LeadField, *, actor, **fields) -> LeadField:
    # type, section and key never change: stored values would stop meaning what they meant
    for k in ("label", "active", "position"):
        if k in fields:
            setattr(fd, k, str(fields[k]).strip()[:80] if k == "label" else fields[k])
    if "options" in fields:
        fd.options = _options(fields["options"])
    fd.save()
    live.board()
    return fd


def field_delete(fd: LeadField, *, actor) -> None:
    fd.delete()  # values stay in the JSON, just no longer shown
    live.board()


def _split_custom(values: dict) -> tuple[dict, dict]:
    """(deal/extra values, contact values) — only active fields, only scalar values."""
    fields = dict(LeadField.objects.filter(active=True).values_list("key", "section"))
    ok = {k: v for k, v in (values or {}).items()
          if k in fields and (v is None or isinstance(v, str | int | float | bool))}
    contact = {k: v for k, v in ok.items() if fields[k] == LeadField.Section.CONTACT}
    return {k: v for k, v in ok.items() if k not in contact}, contact


def _save_contact_values(client, values: dict) -> None:
    if not values:
        return
    if client is None:
        raise ValidationFailed("Avval mijozni biriktiring", field="custom")
    cd, _ = ClientData.objects.get_or_create(client=client)
    cd.custom = {**(cd.custom or {}), **values}
    cd.save(update_fields=["custom"])


# ------------------------------------------------------------------ leads


def money(v) -> Decimal:
    try:
        return max(Decimal("0"), Decimal(str(v or 0)).quantize(Decimal("0.01")))
    except (InvalidOperation, ValueError) as e:
        raise ValidationFailed("Summa noto'g'ri", field="budget") from e


def clean_tags(tags) -> list[str]:
    out = [str(t).strip()[:40] for t in tags or [] if str(t).strip()]
    return list(dict.fromkeys(out))[:15]


def employee_of(user):
    return getattr(user, "employee", None) if user is not None else None


def status_of(stage: Stage) -> str:
    return LeadStatus.WON if stage.is_won else LeadStatus.LOST if stage.is_lost else LeadStatus.OPEN


@transaction.atomic
def lead_create(*, actor, pipeline: Pipeline | None = None, stage: Stage | None = None, auto_manager: bool = False,
                custom: dict | None = None, notify: bool = True, **fields) -> Lead:
    """`auto_manager`: nobody chose a manager — the distribution add-on picks one (when it is on)."""
    from apps.crm.services.extras import pick_manager

    if stage is not None:
        pipeline = stage.pipeline
    pipeline = pipeline or default_pipeline()
    stage = stage or first_open_stage(pipeline)
    if stage.pipeline_id != pipeline.pk:
        raise ValidationFailed("Bosqich boshqa voronkada", field="stage_id")
    phone = phones.pretty(fields.pop("phone", "") or "")
    if not fields.get("client") and phone:
        fields["client"] = selectors.client_by_phone(phone)
    if not (fields.get("title") or "").strip():
        fields["title"] = fields.get("contact_name") or (fields["client"].name if fields.get("client") else "") or phone
    if not fields["title"]:
        raise ValidationFailed("Lid nomi, aloqa shaxsi yoki telefonni kiriting", field="title")
    if auto_manager and not fields.get("manager"):
        fields["manager"] = pick_manager()
    fields["tags"] = clean_tags(fields.get("tags"))
    deal, contact = _split_custom(custom or {})
    lead = Lead(pipeline=pipeline, stage=stage, status=status_of(stage), phone=phone, custom=deal, **fields)
    lead.title = lead.title[:200]
    lead.stamp(actor, created=True)
    lead.save()  # chatter: "Lid yaratildi"
    assign_code(lead, "LD")
    _save_contact_values(lead.client, contact)
    if notify:
        live.lead_assigned(lead, by=actor)
        live.board(pipeline.pk)
    return lead


@transaction.atomic
def lead_update(lead: Lead, *, actor, custom: dict | None = None, **fields) -> Lead:
    if "phone" in fields:
        fields["phone"] = phones.pretty(fields["phone"] or "")
        if not lead.client_id and not fields.get("client") and fields["phone"]:
            fields["client"] = selectors.client_by_phone(fields["phone"]) or fields.get("client")
    if "tags" in fields:
        fields["tags"] = clean_tags(fields["tags"])
    manager_before = lead.manager_id
    for k, v in fields.items():
        setattr(lead, k, v)
    if custom:
        deal, contact = _split_custom(custom)
        lead.custom = {**(lead.custom or {}), **deal}
        _save_contact_values(lead.client, contact)
    lead.stamp(actor)
    lead.save()  # chatter tracks the changed fields
    if lead.manager_id and lead.manager_id != manager_before:
        live.lead_assigned(lead, by=actor)
    live.board(lead.pipeline_id)
    return lead


def set_stage(lead: Lead, stage: Stage, *, actor, comment: str = "", lost_reason: str = "") -> None:
    before = {"stage": lead.stage_id, "status": lead.status, "lost_reason": lead.lost_reason}
    lead.stage = stage
    lead.status = status_of(stage)
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
    set_stage(lead, stage, actor=actor, lost_reason=lost_reason)
    live.board(lead.pipeline_id)
    return lead


def lead_delete(lead: Lead, *, actor) -> None:
    if lead.project_id:
        raise Conflict("Liddan loyiha ochilgan — o'chirib bo'lmaydi")
    lead.soft_delete()
    live.board(lead.pipeline_id)


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
        set_stage(lead, won, actor=actor, comment=f"Loyiha ochildi: {project.code}")
    else:
        with muted():
            lead.save()
    changes = diff(lead, before, {"client": "Mijoz", "project": "Loyiha"})
    if changes:
        post(lead, kind="track", changes=changes, actor=actor)
    live.board(lead.pipeline_id)
    return lead


# ------------------------------------------------------------------ tasks


def task_line(t: LeadTask) -> str:
    when = f" ({timezone.localtime(t.due_at):%d.%m %H:%M})" if t.due_at else ""
    return f"{t.kind}{' — ' + t.text if t.text else ''}{when}"


@transaction.atomic
def task_create(*, actor, lead: Lead, **fields) -> LeadTask:
    fields.setdefault("assignee", actor)
    fields["kind"] = (fields.get("kind") or crm_settings().task_types[0]).strip()[:40]
    t = LeadTask(lead=lead, **fields)
    t.stamp(actor, created=True)
    t.save()
    Lead.objects.filter(pk=lead.pk).update(updated_at=timezone.now())
    event(lead, f"Vazifa: {task_line(t)}", actor=actor)
    live.board(lead.pipeline_id)
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
    if "due_at" in fields:
        t.reminded_at = None
    t.stamp(actor)
    t.save()
    if t.done != was_done:
        event(t.lead, f"Vazifa {'bajarildi' if t.done else 'qayta ochildi'}: {task_line(t)}", actor=actor)
    live.board(t.lead.pipeline_id)
    return t


def task_delete(t: LeadTask, *, actor) -> None:
    lead, line = t.lead, task_line(t)
    t.delete()
    event(lead, f"Vazifa o'chirildi: {line}", actor=actor)
    live.board(lead.pipeline_id)
