"""Reads: the board, phone matching, call stats, the user's phone settings."""

from datetime import timedelta

from django.db.models import Count, Exists, F, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.clients.models import Client
from apps.crm import phones
from apps.crm.models import (
    Call,
    CallDirection,
    CallStatus,
    Extension,
    Lead,
    LeadStatus,
    LeadTask,
    Pipeline,
    TelephonySettings,
)

BOARD_CLOSED_DAYS = 30


def leads_qs():
    """Leads with what a card shows: the next open task, counts, the last activity (subqueries: joins would
    multiply each other)."""
    from apps.chatter.models import Message

    tasks = LeadTask.objects.filter(lead=OuterRef("pk"), done=False).order_by(F("due_at").asc(nulls_last=True), "id")
    calls = Call.objects.filter(lead=OuterRef("pk")).values("lead").annotate(n=Count("id")).values("n")
    missed = (Call.objects.filter(lead=OuterRef("pk"), status__in=[CallStatus.MISSED, CallStatus.NO_ANSWER])
              .values("lead").annotate(n=Count("id")).values("n"))
    last = Message.objects.filter(model="crm.lead", res_id=OuterRef("pk"), kind__in=["note", "event"]).order_by(
        "-created_at", "-pk")
    return Lead.objects.select_related("pipeline", "stage", "client__crm_data", "manager", "source", "project").annotate(
        next_task_kind=Subquery(tasks.values("kind")[:1]),
        next_task_text=Subquery(tasks.values("text")[:1]),
        next_task_due=Subquery(tasks.values("due_at")[:1]),
        open_tasks=Coalesce(Subquery(tasks.values("lead").annotate(n=Count("id")).values("n")), Value(0),
                            output_field=IntegerField()),
        calls_count=Coalesce(Subquery(calls), Value(0), output_field=IntegerField()),
        missed_calls=Coalesce(Subquery(missed), Value(0), output_field=IntegerField()),
        last_activity=Subquery(last.values("body")[:1]),
        last_activity_at=Subquery(last.values("created_at")[:1]),
    )


def board_leads(pipeline: Pipeline, qs=None, *, closed_all: bool = False) -> list[Lead]:
    """The pipeline's leads for the board: won / lost ones untouched for 30 days leave it unless a filter asks
    for closed leads (the list keeps them all)."""
    since = timezone.now() - timedelta(days=BOARD_CLOSED_DAYS)
    qs = (qs if qs is not None else leads_qs()).filter(pipeline=pipeline)
    if not closed_all:
        qs = qs.filter(Q(status=LeadStatus.OPEN) | Q(updated_at__gte=since))
    return list(qs.order_by("-stage_changed_at", "-id"))


# ------------------------------------------------------------------ phone matching
# Phones are stored as people typed them ("+998 90 123-45-67"): narrow by the last two digits in SQL,
# compare the 9-digit key in Python.


def _tail(key: str) -> str:
    return key[-2:]


def client_by_phone(raw: str | None) -> Client | None:
    k = phones.key(raw)
    if not k:
        return None
    qs = Client.objects.filter(Q(phone__endswith=_tail(k)) | Q(phone_extra__endswith=_tail(k))).order_by("id")
    for c in qs.only("id", "phone", "phone_extra", "name"):
        if k in (phones.key(c.phone), phones.key(c.phone_extra)):
            return c
    return None


def open_lead_by_phone(raw: str | None) -> Lead | None:
    """The most recently touched open lead whose own phone or client's phone is this number."""
    k = phones.key(raw)
    if not k:
        return None
    qs = (Lead.objects.filter(status=LeadStatus.OPEN)
          .filter(Q(phone__endswith=_tail(k)) | Q(client__phone__endswith=_tail(k)))
          .select_related("client").order_by("-updated_at", "-id"))
    for lead in qs:
        if k in (phones.key(lead.phone), phones.key(lead.client.phone if lead.client else "")):
            return lead
    return None


# ------------------------------------------------------------------ telephony


def calls_qs():
    return Call.objects.select_related("user", "client", "lead")


def call_stats(since, until, user=None) -> dict:
    qs = Call.objects.filter(started_at__gte=since, started_at__lt=until).exclude(direction=CallDirection.INTERNAL)
    if user is not None:
        qs = qs.filter(user=user)
    agg = qs.aggregate(
        incoming=Count("id", filter=Q(direction=CallDirection.IN)),
        outgoing=Count("id", filter=Q(direction=CallDirection.OUT)),
        answered=Count("id", filter=Q(status=CallStatus.ANSWERED)),
        missed=Count("id", filter=Q(status=CallStatus.MISSED)),
        talk=Sum("duration"),
        new_leads=Count("id", filter=Q(created_lead=True)),
    )
    # missed in the period that nobody got through to afterwards
    later = Call.objects.filter(client_phone=OuterRef("client_phone"), started_at__gt=OuterRef("started_at"),
                                status=CallStatus.ANSWERED)
    missed_open = qs.filter(status=CallStatus.MISSED).exclude(client_phone="").filter(~Exists(later)).count()
    return {**{k: v or 0 for k, v in agg.items() if k != "talk"}, "talk_seconds": agg["talk"] or 0,
            "missed_open": missed_open}


def softphone_config(user, st: TelephonySettings) -> dict | None:
    """What the browser phone needs. The address comes from the extension's connection (or the first telephony
    connection that has one); the SIP password goes only to its owner, only when the phone is on."""
    from apps.crm.models import Connection

    ext = Extension.objects.filter(user=user).select_related("connection").first()
    if ext is None:
        return None
    conn = ext.connection if ext.connection and (ext.connection.config or {}).get("sip_wss") else None
    if conn is None:
        conn = next((c for c in Connection.objects.filter(kind__in=Connection.TELEPHONY, enabled=True)
                     if (c.config or {}).get("sip_wss")), None)
    cfg = (conn.config or {}) if conn else {}
    wss = str(cfg.get("sip_wss") or "").strip()
    if wss and not wss.startswith(("wss://", "ws://")):
        wss = ""  # a typo (wws://…) would break the browser phone: treat it as not set
    elif wss and "/" not in wss.split("://", 1)[1]:
        wss += "/ws"  # Asterisk / UTeL: SIP over WebSocket lives at /ws
    out = {"extension": ext.number, "softphone": ext.softphone, "wss": wss,
           "domain": str(cfg.get("sip_domain") or "").strip(), "sip_login": "", "sip_password": "",
           "provider": ext.connection.kind if ext.connection else (conn.kind if conn else "")}
    if ext.softphone and wss and st.enabled:
        out["sip_login"] = ext.sip_login or ext.number
        out["sip_password"] = ext.sip_password
    return out
