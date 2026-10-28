"""Telephony: calls in from the PBX (webhook / history sync / browser phone) and into the CRM
(uzbridge crm/telephony.py).

ingest() — one event or history record: upsert the Call, find the operator by extension and the client / open
lead by number, push it to the operator, and once the call has ended apply the rules (TelephonySettings): link or
create the lead, write the call into the lead's and client's history, a call-back task for a missed one.
"""

import json
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.chatter.services import event
from apps.core.exceptions import Conflict, NotFound, ValidationFailed
from apps.crm import phones, selectors
from apps.crm.models import (
    CALL_TASK,
    LIVE_STATUSES,
    Call,
    CallDirection,
    CallStatus,
    Connection,
    Extension,
    Lead,
    LeadTask,
    Responsible,
    TelephonySettings,
)
from apps.crm.normalize import NormalCall, normalize
from apps.crm.providers import moizvonki, utel
from apps.crm.providers.http import ProviderError
from apps.crm.providers.rest import RestClient
from apps.crm.services import live
from apps.crm.services.leads import employee_of, task_line
from apps.crm.services.routing import route

DIRECTION_TEXT = {"in": "Kiruvchi qo'ng'iroq", "out": "Chiquvchi qo'ng'iroq", "internal": "Ichki qo'ng'iroq"}
STATUS_TEXT = {"missed": "o'tkazib yuborildi", "no_answer": "javob berilmadi", "busy": "band", "failed": "ulanmadi"}
STALE_AFTER = timedelta(minutes=30)
SOFTPHONE_QUIET = timedelta(days=2)  # a PBX webhook this recent owns the call records

# ------------------------------------------------------------------ settings and extensions


def telephony_settings() -> TelephonySettings:
    st, _ = TelephonySettings.objects.get_or_create(pk=1)
    return st


def telephony_settings_update(*, actor, **fields) -> TelephonySettings:
    st = telephony_settings()
    if "lead_title" in fields:
        fields["lead_title"] = (fields["lead_title"] or "").strip()[:150] or "Qo'ng'iroq: {phone}"
    if "tags" in fields:
        fields["tags"] = [str(t).strip()[:40] for t in fields["tags"] or [] if str(t).strip()][:10]
    if fields.get("stage") is not None:
        fields["pipeline"] = fields["stage"].pipeline
    for k, v in fields.items():
        setattr(st, k, v)
    st.save()
    return st


def extension_create(*, actor, **fields) -> Extension:
    _check_extension(fields.get("user"), fields.get("number"))
    fields["number"] = (fields.get("number") or "").strip().lower()
    return Extension.objects.create(**fields)


def extension_update(ext: Extension, *, actor, **fields) -> Extension:
    _check_extension(fields.get("user", ext.user), fields.get("number", ext.number), exclude=ext.pk)
    if fields.get("sip_password") in (None, ""):
        fields.pop("sip_password", None)  # write-only: an empty field keeps the saved one
    if "number" in fields:
        fields["number"] = (fields["number"] or "").strip().lower()
    for k, v in fields.items():
        setattr(ext, k, v)
    ext.save()
    return ext


def _check_extension(user, number, exclude=None) -> None:
    qs = Extension.objects.exclude(pk=exclude)
    if user is not None and qs.filter(user=user).exists():
        raise Conflict("Bu foydalanuvchiga ichki raqam biriktirilgan", field="user_id")
    if number and qs.filter(number__iexact=number.strip()).exists():
        raise Conflict("Bu ichki raqam band", field="number")


def extension_delete(ext: Extension, *, actor) -> None:
    ext.delete()


# ------------------------------------------------------------------ ingest


def fmt_duration(sec: int) -> str:
    return f"{sec // 60}:{sec % 60:02d}"


def call_text(call: Call) -> str:
    parts = [DIRECTION_TEXT.get(call.direction, "Qo'ng'iroq"), phones.pretty(call.client_phone)]
    parts.append(fmt_duration(call.duration) if call.status == CallStatus.ANSWERED else STATUS_TEXT.get(call.status, ""))
    return " · ".join(p for p in parts if p)


def own_numbers(conn: Connection | None) -> list[str]:
    raw = str((conn.config or {}).get("numbers") or "") if conn else ""
    return [n.strip() for n in raw.replace(";", ",").split(",") if n.strip()]


def user_for_extension(ext: str, conn_id: int | None = None):
    """The operator of an internal number; a Moi Zvonki login (email) also matches a user with that email."""
    if not ext:
        return None
    for e in Extension.objects.filter(number__iexact=ext).select_related("user"):
        if e.connection_id in (None, conn_id):
            return e.user
    if "@" in ext:
        from apps.users.models import User

        return User.objects.filter(email__iexact=ext, is_active=True).first()
    return None


def _flatten_provider(payload: dict) -> dict | None:
    """UTeL / Moi Zvonki envelopes → the generic shape normalize() reads; anything else as it is."""
    if utel.is_utel(payload):
        flat = utel.webhook_flat(payload)
        return None if flat is None else {**flat, "_utel": payload}
    if moizvonki.is_moizvonki(payload):
        flat = moizvonki.webhook_flat(payload)
        return None if flat is None else {**flat, "_moizvonki": payload}
    return payload


def ingest(payload: dict, *, conn: Connection | None = None, source: str = Call.Source.WEBHOOK, user=None,
           final: bool | None = None) -> Call | None:
    flat = _flatten_provider(payload) if isinstance(payload, dict) else None
    if flat is None:
        return None
    nc = normalize(flat, company_numbers=own_numbers(conn), final=final)
    if nc is None:
        return None
    if conn is not None and conn.kind == Connection.Kind.UTEL:
        _learn_company_number(conn, utel.company_number(flat))
    for attempt in (1, 2):  # a PBX sends two events of one call at the same instant: one insert wins
        try:
            return _ingest(nc, conn, source, user)
        except IntegrityError:
            if attempt == 2:
                raise
    return None


def _ingest(nc: NormalCall, conn: Connection | None, source: str, user) -> Call:
    st = telephony_settings()
    with transaction.atomic():
        call = Call.objects.select_for_update().filter(external_id=nc.external_id[:120]).first()
        if call is None:
            call = Call(external_id=nc.external_id[:120], source=source, connection=conn,
                        started_at=nc.started_at or timezone.now())
        elif call.status not in LIVE_STATUSES and not nc.final:
            return call  # a late "ringing" after the end
        _apply(call, nc)
        if call.user_id is None:
            call.user = user or user_for_extension(call.extension, conn.pk if conn else None)
        if call.client_id is None and call.client_phone:
            call.client = selectors.client_by_phone(call.client_phone)
        if call.lead_id is None and call.client_phone and st.duplicate == "open_lead":
            call.lead = selectors.open_lead_by_phone(call.client_phone)
        call.save()
        if conn is not None and source == Call.Source.WEBHOOK:
            Connection.objects.filter(pk=conn.pk).update(
                last_event_at=timezone.now(), events_count=F("events_count") + 1, status="ok", last_error="")
        if nc.final and not call.processed and call.direction != CallDirection.INTERNAL:
            # only calls that arrive live make leads and tasks; history only links
            apply_rules(call, st, create=source != Call.Source.SYNC)
        if nc.final and call.recording_url and not call.recording_file_id:
            from apps.crm.services.recordings import recording_queue

            transaction.on_commit(lambda c=call: recording_queue(c))
    if source != Call.Source.SYNC:
        live.call(call)
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


def _learn_company_number(conn: Connection, number: str) -> None:
    """UTeL names the company's own line (external_number): remember it so it is never taken for a client."""
    num = phones.normalize(number)
    if not num:
        return
    have = own_numbers(conn)
    if not any(phones.key(n) == phones.key(num) for n in have):
        conn.config = {**(conn.config or {}), "numbers": ", ".join([*have, num])}
        Connection.objects.filter(pk=conn.pk).update(config=conn.config)


def _responsible(call: Call, st: TelephonySettings):
    if st.responsible == Responsible.FIXED and st.fixed_manager_id:
        return st.fixed_manager
    if st.responsible == Responsible.OWNER and call.client_id:
        last = Lead.objects.filter(client_id=call.client_id, manager__isnull=False).order_by("-id").first()
        return (last.manager if last else None) or call.client.manager or employee_of(call.user)
    return employee_of(call.user)


def apply_rules(call: Call, st: TelephonySettings | None = None, *, create: bool = True) -> None:
    """An ended call goes into the CRM: lead linked / created, history lines, a call-back task when missed.

    create=False (history sync): only link to the number's open lead and write the history — no new clients,
    leads or tasks for calls that are already in the past."""
    st = st or telephony_settings()
    call.processed = True
    if call.lead_id is None and call.client_phone and not create:
        call.lead = selectors.open_lead_by_phone(call.client_phone)
    elif call.lead_id is None and call.client_phone:
        unknown = (st.outgoing_unknown if call.direction == CallDirection.OUT
                   else st.missed_unknown if call.status == CallStatus.MISSED else st.incoming_unknown)
        pretty = phones.pretty(call.client_phone)
        r = route(phone=call.client_phone, unknown=unknown, duplicate=st.duplicate,
                  title=(st.lead_title or "{phone}").replace("{phone}", pretty), pipeline_id=st.pipeline_id,
                  stage_id=st.stage_id, manager=_responsible(call, st), source=st.source, tags=st.tags,
                  note=f"Lid qo'ng'iroqdan yaratildi: {pretty}")
        call.client = r.client or call.client
        if r.lead is not None:
            call.lead, call.created_lead = r.lead, r.created_lead
    call.save()
    lead = call.lead
    if not (call.status == CallStatus.ANSWERED and call.duration < st.min_duration):
        text = call_text(call)
        if lead is not None:
            event(lead, text, actor=call.user)
        if call.client_id:
            event(call.client, text, actor=call.user)
    if lead is None:
        return
    callbacks = lead.tasks.filter(done=False, call__isnull=False)
    if call.status == CallStatus.ANSWERED:
        # they got through (or we called back): the open call-back tasks are done
        for t in callbacks:
            t.done, t.done_at = True, timezone.now()
            t.save(update_fields=["done", "done_at", "updated_at"])
            event(lead, f"Vazifa bajarildi: {task_line(t)}", actor=call.user)
    elif create and call.status == CallStatus.MISSED and st.missed_task and not callbacks.exists():
        manager_user = lead.manager.user if lead.manager_id and lead.manager.user_id else None
        t = LeadTask.objects.create(
            lead=lead, kind=CALL_TASK, call=call, assignee=call.user or manager_user,
            text=f"Qayta qo'ng'iroq qilish: {phones.pretty(call.client_phone)}",
            due_at=timezone.now() + timedelta(minutes=st.missed_task_minutes),
        )
        event(lead, f"Vazifa: {task_line(t)}")
    Lead.objects.filter(pk=lead.pk).update(updated_at=timezone.now())
    live.board(lead.pipeline_id)


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
        live.board(lead.pipeline_id)
    call.save()
    live.call(call)
    return call


@transaction.atomic
def call_create_lead(call: Call, *, actor) -> Call:
    if call.lead_id:
        raise Conflict("Qo'ng'iroq lidga bog'langan")
    if not call.client_phone:
        raise ValidationFailed("Raqam yo'q — lid yaratib bo'lmaydi")
    st = telephony_settings()
    pretty = phones.pretty(call.client_phone)
    r = route(phone=call.client_phone, unknown="create_lead", duplicate="always_new",
              title=(st.lead_title or "{phone}").replace("{phone}", pretty), pipeline_id=st.pipeline_id,
              stage_id=st.stage_id, manager=employee_of(call.user) or employee_of(actor), source=st.source,
              tags=st.tags, note=f"Lid qo'ng'iroqdan yaratildi: {pretty}", actor=actor)
    call.lead, call.created_lead, call.processed = r.lead, True, True
    call.client = call.client or r.client
    call.save()
    event(r.lead, call_text(call), actor=call.user or actor)
    live.call(call)
    return call


# ------------------------------------------------------------------ softphone, click-to-call


def softphone_report(*, actor, data: dict) -> Call | None:
    """The browser phone reports its own calls like a PBX would — only while no PBX webhook is live
    (the PBX's record is the one; a second would duplicate it)."""
    recent = timezone.now() - SOFTPHONE_QUIET
    if Connection.objects.filter(kind__in=Connection.TELEPHONY, enabled=True, last_event_at__gte=recent).exists():
        return None
    ext = Extension.objects.filter(user=actor).first()
    if ext is None:
        raise NotFound("Sizga ichki raqam biriktirilmagan")
    payload = {k: v for k, v in data.items() if k in ("call_id", "event", "direction", "from", "to", "billsec")}
    payload["extension"] = ext.number
    payload["call_id"] = f"sp-{actor.pk}-{payload.get('call_id', '')}"
    call = ingest(payload, conn=ext.connection, source=Call.Source.SOFTPHONE, user=actor)
    if call is None:
        raise ValidationFailed("Qo'ng'iroq ma'lumoti yetarli emas")
    return call


def dial(*, actor, number: str) -> dict:
    """Click-to-call through the provider: Moi Zvonki rings the employee's own mobile; an IP-PBX with an
    originate path rings the extension. Otherwise the browser phone or the device dialer is used."""
    if not phones.digits(number):
        raise ValidationFailed("Raqamni kiriting", field="number")
    ext = Extension.objects.filter(user=actor).select_related("connection").first()
    tel = Connection.objects.filter(kind__in=Connection.TELEPHONY, enabled=True)
    conn = (ext.connection if ext else None) or tel.first()
    if ext is None:
        conn = tel.filter(kind=Connection.Kind.MOIZVONKI).first()  # Moi Zvonki knows the employee by email
        if conn is None:
            raise ValidationFailed("Sizga ichki raqam biriktirilmagan (Telefoniya → Sozlamalar)")
    if conn is None:
        raise ValidationFailed("Telefoniya ulanmagan")
    try:
        if conn.kind == Connection.Kind.MOIZVONKI:
            login = ext.number if ext and "@" in ext.number else actor.email
            moizvonki.make_call(conn.config, conn.get_secrets().get("api_key", ""), login,
                                phones.normalize(number), ext.sip_password if ext else "")
            return {"ok": True, "mobile": True}
        path = str((conn.config or {}).get("originate_path") or "").strip()
        if not path:
            raise ValidationFailed("Click-to-call sozlanmagan — brauzer telefonini yoqing")
        RestClient(conn).request("POST", path, json_body={"extension": ext.number if ext else "",
                                                          "number": phones.normalize(number)})
        return {"ok": True}
    except ProviderError as e:
        raise ValidationFailed(str(e)) from e
