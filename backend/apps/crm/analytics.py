"""CRM analytics (uzbridge crm/analytics.py): the voronka and the calls for a period. Reads only.

Stage history comes from the lead's chatter (track lines with field "stage" / "status", names as people read
them), so a renamed stage counts under its current name only from the rename on.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import median

from django.db.models import Q
from django.utils import timezone

from apps.chatter.models import Message
from apps.crm.models import (
    BAD_STATUSES,
    Call,
    CallDirection,
    CallStatus,
    Connection,
    Lead,
    LeadStatus,
    LeadTask,
    Pipeline,
)

STALE_DAYS = 3
MAX_LEADS = 20000
WON_LABEL, LOST_LABEL = LeadStatus.WON.label, LeadStatus.LOST.label


def _pct(a, b):
    return round(a * 100 / b) if b else None


def _med(xs):
    return round(median(xs), 1) if xs else None


def _days(since: datetime, until: datetime) -> list:
    d, end, out = timezone.localtime(since).date(), timezone.localtime(until).date(), []
    while d < end and len(out) < 400:
        out.append(d)
        d += timedelta(days=1)
    return out


def _tracks(ids: list[int]) -> dict[int, list]:
    """lead id → its track lines (oldest first) that touched the stage or the status."""
    out: dict[int, list] = defaultdict(list)
    for i in range(0, len(ids), 900):
        for m in Message.objects.filter(model="crm.lead", kind="track", res_id__in=ids[i:i + 900]).order_by(
                "created_at", "pk").only("res_id", "changes", "created_at"):
            ch = {c.get("field"): c for c in m.changes or []}
            if "stage" in ch or "status" in ch:
                out[m.res_id].append((m.created_at, ch))
    return out


def crm_analytics(since: datetime, until: datetime, pipeline: Pipeline, manager_id: int | None = None) -> dict:
    now = timezone.now()
    base = Lead.objects.filter(pipeline=pipeline)
    if manager_id:
        base = base.filter(manager_id=manager_id)
    came = list(base.filter(created_at__gte=since, created_at__lt=until).select_related("source", "stage", "manager")
                [:MAX_LEADS])
    base_ids = list(base.values_list("pk", flat=True))
    tracks = _tracks(base_ids)
    leads = {ld.pk: ld for ld in base.filter(pk__in=list(tracks)).select_related("source", "manager")}
    for ld in came:
        leads.setdefault(ld.pk, ld)

    # closed in the period: the last status change to won / lost, if the lead is still in that status
    closed: dict[int, tuple[str, datetime]] = {}
    for lid, lines in tracks.items():
        for at, ch in lines:
            new = (ch.get("status") or {}).get("new")
            if new in (WON_LABEL, LOST_LABEL) and since <= at < until:
                closed[lid] = ("won" if new == WON_LABEL else "lost", at)
    won = [(leads[i], at) for i, (k, at) in closed.items() if k == "won" and i in leads and leads[i].status == "won"]
    lost = [(leads[i], at) for i, (k, at) in closed.items() if k == "lost" and i in leads and leads[i].status == "lost"]
    won_budget = sum(ld.budget for ld, _ in won)
    open_qs = base.filter(status=LeadStatus.OPEN)
    tasks = LeadTask.objects.filter(lead__in=open_qs, done=False)
    totals = {
        "new": len(came), "won": len(won), "lost": len(lost), "open": open_qs.count(),
        "stale": open_qs.filter(updated_at__lt=now - timedelta(days=STALE_DAYS)).count(),
        "win_rate": _pct(len(won), len(won) + len(lost)), "won_budget": str(won_budget),
        "avg_deal": str(round(won_budget / len(won))) if won else None,
        "days_to_win": _med([(at - ld.created_at).total_seconds() / 86400 for ld, at in won]),
        "tasks_open": tasks.count(), "tasks_overdue": tasks.filter(due_at__lt=now).count(),
    }

    series = {d: {"day": d.isoformat(), "new": 0, "won": 0, "lost": 0} for d in _days(since, until)}
    for ld in came:
        row = series.get(timezone.localtime(ld.created_at).date())
        if row:
            row["new"] += 1
    for kind, rows in (("won", won), ("lost", lost)):
        for _, at in rows:
            row = series.get(timezone.localtime(at).date())
            if row:
                row[kind] += 1

    funnel = _funnel(pipeline, came, tracks, now)
    sources: dict[str, dict] = {}
    for ld in came:
        name = ld.source.name if ld.source_id else "—"
        r = sources.setdefault(name, {"source": name, "new": 0, "won": 0, "lost": 0, "won_budget": 0})
        r["new"] += 1
        r["won"] += ld.status == "won"
        r["lost"] += ld.status == "lost"
        r["won_budget"] += ld.budget if ld.status == "won" else 0
    reasons: dict[str, int] = defaultdict(int)
    for ld, _ in lost:
        reasons[ld.lost_reason or "—"] += 1
    return {
        "totals": totals, "series": list(series.values()), "funnel": funnel,
        "sources": sorted(({**r, "won_budget": str(r["won_budget"])} for r in sources.values()),
                          key=lambda r: -r["new"]),
        "lost_reasons": sorted(({"reason": k, "leads": v} for k, v in reasons.items()), key=lambda r: -r["leads"]),
        "managers": _managers(base, came, won, lost, since, until, now),
    }


def _funnel(pipeline: Pipeline, came: list[Lead], tracks: dict, now) -> list[dict]:
    work = list(pipeline.stages.filter(is_won=False, is_lost=False))
    if not work:
        return []
    pos = {s.name.strip().lower(): i for i, s in enumerate(work)}
    by_id = {s.pk: i for i, s in enumerate(work)}
    reached = [0] * len(work)
    hours: list[list[float]] = [[] for _ in work]
    for ld in came:
        lines = [(at, ch["stage"]) for at, ch in tracks.get(ld.pk, []) if "stage" in ch]
        visited = {0}
        if ld.stage_id in by_id:
            visited.add(by_id[ld.stage_id])
        for _, c in lines:
            for name in (c.get("old"), c.get("new")):
                if str(name or "").strip().lower() in pos:
                    visited.add(pos[str(name).strip().lower()])
        top = len(work) if ld.status == "won" else max(visited)
        for i in range(min(top, len(work) - 1) + 1):
            reached[i] += 1
        # time in stage: replay the moves; a lead that moved started in the first work stage
        cur = 0 if lines else by_id.get(ld.stage_id)
        t0 = ld.created_at
        for at, c in lines:
            if cur is not None:
                hours[cur].append((at - t0).total_seconds() / 3600)
            cur, t0 = pos.get(str(c.get("new") or "").strip().lower()), at
        if ld.status == "open" and cur is not None:
            hours[cur].append((now - t0).total_seconds() / 3600)
    first, rows, prev = len(came), [], None
    for i, s in enumerate(work):
        n = reached[i]
        rows.append({"stage_id": s.pk, "name": s.name, "tone": s.tone, "leads": n, "of_first": _pct(n, first),
                     "of_prev": _pct(n, prev) if prev is not None else None,
                     "avg_hours": round(sum(hours[i]) / len(hours[i]), 1) if hours[i] else None,
                     "median_hours": _med(hours[i])})
        prev = n
    n = sum(1 for ld in came if ld.status == "won")
    rows.append({"stage_id": None, "name": WON_LABEL, "tone": "ok", "leads": n, "of_first": _pct(n, first),
                 "of_prev": _pct(n, prev), "avg_hours": None, "median_hours": None})
    return rows


def _managers(base, came, won, lost, since, until, now) -> list[dict]:
    from apps.employees.models import Employee

    rows: dict[int, dict] = {}

    def row(emp_id):
        return rows.setdefault(emp_id, {"id": emp_id, "new": 0, "open": 0, "won": 0, "lost": 0, "won_budget": 0,
                                        "overdue": 0, "calls": 0, "talk_seconds": 0, "missed": 0, "_resp": []})

    for ld in came:
        if ld.manager_id:
            row(ld.manager_id)["new"] += 1
    for kind, items in (("won", won), ("lost", lost)):
        for ld, _ in items:
            if ld.manager_id:
                row(ld.manager_id)[kind] += 1
                if kind == "won":
                    row(ld.manager_id)["won_budget"] += ld.budget
    for mid in base.filter(status="open").exclude(manager=None).values_list("manager_id", flat=True):
        row(mid)["open"] += 1
    for mid in LeadTask.objects.filter(lead__in=base.filter(status="open"), done=False, due_at__lt=now).values_list(
            "lead__manager_id", flat=True):
        if mid:
            row(mid)["overdue"] += 1
    # first response: the first line someone wrote on the lead, or the first outgoing call to it
    came_ids = [ld.pk for ld in came]
    first_msg: dict[int, datetime] = {}
    for rid, at in Message.objects.filter(model="crm.lead", res_id__in=came_ids, user__isnull=False).exclude(
            body__endswith="yaratildi").order_by("created_at").values_list("res_id", "created_at"):
        first_msg.setdefault(rid, at)
    for lid, at in Call.objects.filter(lead_id__in=came_ids, direction=CallDirection.OUT).exclude(
            status=CallStatus.FAILED).order_by("started_at").values_list("lead_id", "started_at"):
        if lid not in first_msg or at < first_msg[lid]:
            first_msg[lid] = at
    for ld in came:
        if ld.manager_id and ld.pk in first_msg:
            row(ld.manager_id)["_resp"].append(max(0.0, (first_msg[ld.pk] - ld.created_at).total_seconds() / 60))
    emp_by_user = dict(Employee.objects.exclude(user=None).values_list("user_id", "pk"))
    for uid, direction, status, dur in Call.objects.filter(started_at__gte=since, started_at__lt=until).exclude(
            direction=CallDirection.INTERNAL).exclude(user=None).values_list("user_id", "direction", "status",
                                                                             "duration"):
        if uid in emp_by_user:
            r = row(emp_by_user[uid])
            r["calls"] += 1
            r["talk_seconds"] += dur
            r["missed"] += direction == "in" and status in BAD_STATUSES
    names = dict((e.pk, e.name) for e in Employee.all_objects.filter(pk__in=list(rows)))
    out = []
    for emp_id, r in rows.items():
        resp = r.pop("_resp")
        out.append({**r, "name": names.get(emp_id, f"#{emp_id}"), "won_budget": str(r["won_budget"]),
                    "response_minutes": _med(resp), "win_rate": _pct(r["won"], r["won"] + r["lost"])})
    return sorted(out, key=lambda r: (-float(r["won_budget"]), -r["won"], -r["new"]))


# ------------------------------------------------------------------ calls


def telephony_analytics(since: datetime, until: datetime, user_id: int | None = None,
                        connection_id: int | None = None) -> dict:
    qs = Call.objects.filter(started_at__gte=since, started_at__lt=until).exclude(direction=CallDirection.INTERNAL)
    if user_id:
        qs = qs.filter(user_id=user_id)
    if connection_id:
        qs = qs.filter(connection_id=connection_id)
    calls = list(qs.values("id", "direction", "status", "duration", "wait", "client_phone", "started_at", "user_id",
                           "connection_id"))
    answered_after: dict[str, list] = defaultdict(list)
    for phone, at in Call.objects.filter(status=CallStatus.ANSWERED, started_at__gte=since).exclude(
            client_phone="").values_list("client_phone", "started_at"):
        answered_after[phone].append(at)

    def returned(c) -> float | None:
        later = [at for at in answered_after.get(c["client_phone"], []) if at > c["started_at"]]
        return (min(later) - c["started_at"]).total_seconds() / 60 if later else None

    def agg(rows) -> dict:
        inc = [c for c in rows if c["direction"] == "in"]
        out = [c for c in rows if c["direction"] == "out"]
        missed = [c for c in inc if c["status"] in BAD_STATUSES]
        answered = [c for c in rows if c["status"] == CallStatus.ANSWERED]
        out_ok = [c for c in out if c["status"] == CallStatus.ANSWERED]
        back = [returned(c) for c in missed]
        return {
            "calls": len(rows), "in": len(inc), "out": len(out), "answered": len(answered), "missed": len(missed),
            "out_answered": len(out_ok), "talk_seconds": sum(c["duration"] for c in answered),
            "answer_rate": _pct(len(inc) - len(missed), len(inc)), "out_rate": _pct(len(out_ok), len(out)),
            "avg_talk": round(sum(c["duration"] for c in answered) / len(answered)) if answered else None,
            "missed_returned": sum(1 for b in back if b is not None),
            "missed_open": sum(1 for b in back if b is None),
            "_back": [b for b in back if b is not None],
            "_wait": [c["wait"] for c in inc if c["wait"]],
        }

    totals = agg(calls)
    totals["callback_minutes"] = _med(totals.pop("_back"))
    waits = totals.pop("_wait")
    totals["avg_wait"] = round(sum(waits) / len(waits)) if waits else None

    series = {d: {"day": d.isoformat(), "in": 0, "out": 0, "missed": 0, "talk_seconds": 0} for d in _days(since, until)}
    heat = {"calls": [[0] * 24 for _ in range(7)], "missed": [[0] * 24 for _ in range(7)]}
    for c in calls:
        t = timezone.localtime(c["started_at"])
        row = series.get(t.date())
        bad = c["direction"] == "in" and c["status"] in BAD_STATUSES
        if row:
            row[c["direction"]] += 1
            row["missed"] += bad
            row["talk_seconds"] += c["duration"] if c["status"] == CallStatus.ANSWERED else 0
        heat["calls"][t.weekday()][t.hour] += 1
        heat["missed"][t.weekday()][t.hour] += bad

    from apps.users.models import User

    by_user: dict = defaultdict(list)
    for c in calls:
        by_user[c["user_id"]].append(c)
    names = {u.pk: u.full_name for u in User.objects.filter(pk__in=[k for k in by_user if k])}
    employees = []
    for uid, rows in by_user.items():
        a = agg(rows)
        a.pop("_back"), a.pop("_wait")
        employees.append({"user_id": uid, "name": names.get(uid, "—") if uid else "Biriktirilmagan", **a})
    employees.sort(key=lambda r: (-r["calls"], -r["talk_seconds"]))

    by_conn: dict = defaultdict(list)
    for c in calls:
        by_conn[c["connection_id"]].append(c)
    conn_names = dict(Connection.objects.filter(pk__in=[k for k in by_conn if k]).values_list("pk", "name"))
    connections = sorted(({"connection_id": k, "name": conn_names.get(k, "Telefon"), "calls": len(v),
                           "in": sum(c["direction"] == "in" for c in v), "out": sum(c["direction"] == "out" for c in v),
                           "missed": sum(c["direction"] == "in" and c["status"] in BAD_STATUSES for c in v),
                           "talk_seconds": sum(c["duration"] for c in v if c["status"] == CallStatus.ANSWERED)}
                          for k, v in by_conn.items()), key=lambda r: -r["calls"])

    return {"totals": totals, "series": list(series.values()), "heatmap": heat, "employees": employees,
            "connections": connections, "first_call": _first_call(since, until, user_id)}


def _first_call(since, until, user_id) -> dict:
    """How fast new leads (not born from a call) got their first outgoing call."""
    leads = Lead.objects.filter(created_at__gte=since, created_at__lt=until).exclude(
        Q(title__startswith="Qo'ng'iroq:"))
    if user_id:
        leads = leads.filter(manager__user_id=user_id)
    leads = list(leads.values("pk", "created_at")[:MAX_LEADS])
    first: dict[int, datetime] = {}
    for lid, at in Call.objects.filter(lead_id__in=[x["pk"] for x in leads], direction=CallDirection.OUT).order_by(
            "started_at").values_list("lead_id", "started_at"):
        first.setdefault(lid, at)
    mins = [(first[x["pk"]] - x["created_at"]).total_seconds() / 60 for x in leads if x["pk"] in first
            and first[x["pk"]] >= x["created_at"]]
    return {"leads": len(leads), "called": len(mins), "fast": sum(1 for m in mins if m <= 15),
            "median_minutes": _med(mins), "fast_minutes": 15}
