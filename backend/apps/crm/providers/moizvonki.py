"""Moi Zvonki (moizvonki.ru): calls made on the staff's own mobiles (uzbridge crm/moizvonki.py).

API: POST https://<domain>.moizvonki.ru/api/v1 with JSON {"user_name": email, "api_key", "action", …params}.
  calls.list       from_date / to_date (UTC seconds), supervised=1, max_results ≤ 100, from_offset
                   → {results, results_next_offset (0 = the end)}
  calls.make_call  to — rings out from the phone of the user the request is made as
  webhook.subscribe {hooks: {event: url}} (admin only, replaces the previous URL), webhook.list, webhook.unsubscribe

Webhook: {"webhook": {"action": "call.start|call.answer|call.finish|sms.message", "user_login": email},
"event": {direction 0 in / 1 out, client_number, event_pbx_call_id, src_number (the SIM), and on call.finish
start_time, answer_time (0 = not answered), end_time, duration, answered 0|1, recording, db_call_id}}.
For an outgoing call call.answer comes straight after call.start: the real answer is only known at call.finish.
"""

from datetime import datetime

import httpx

from apps.crm.providers import http
from apps.crm.providers.http import ProviderError

HOOKS = ("call.start", "call.answer", "call.finish")


def is_moizvonki(payload: dict) -> bool:
    w = payload.get("webhook")
    return isinstance(w, dict) and isinstance(payload.get("event"), dict) and "action" in w


def _ts(v) -> int:
    try:
        return int(float(v or 0))
    except (TypeError, ValueError):
        return 0


def _call_id(e: dict) -> str:
    # every event of one call shares event_pbx_call_id; a history record may only have db_call_id
    return str(e.get("event_pbx_call_id") or (f"mz-{e['db_call_id']}" if e.get("db_call_id") else ""))


def record_flat(e: dict, login: str = "") -> dict:
    """A finished call (call.finish or a calls.list record) → our flat call."""
    direction = "out" if str(e.get("direction")) == "1" else "in"
    start, answer, end = _ts(e.get("start_time")), _ts(e.get("answer_time")), _ts(e.get("end_time"))
    answered = str(e.get("answered")) == "1"
    talk = max(0, end - answer) if answered and answer and end else (_ts(e.get("duration")) if answered else 0)
    sim, client = e.get("src_number") or "", e.get("client_number") or ""
    return {
        "call_id": _call_id(e),
        "direction": direction,
        "event": "hangup",
        "from": client if direction == "in" else sim,
        "to": sim if direction == "in" else client,
        "client": client,
        "company_number": sim,
        "extension": (login or e.get("user_account") or "").lower(),
        "billsec": talk,
        "wait": max(0, answer - start) if answered and answer and start else 0,
        "disposition": "ANSWERED" if answered else "NO ANSWER",
        "start_time": start or None,
        "answer_time": answer or None,
        "end_time": end or None,
        "recording_url": e.get("recording") or "",
    }


def webhook_flat(payload: dict) -> dict | None:
    """A Moi Zvonki webhook → our flat call; None for an SMS or an unknown event."""
    w, e = payload["webhook"], payload["event"]
    action, login = w.get("action"), str(w.get("user_login") or "").lower()
    if action == "call.finish":
        return record_flat(e, login)
    if action not in ("call.start", "call.answer"):
        return None
    direction = "out" if str(e.get("direction")) == "1" else "in"
    sim, client = e.get("src_number") or "", e.get("client_number") or ""
    event = "answer" if action == "call.answer" and direction == "in" else "ringing"
    return {
        "call_id": _call_id(e), "direction": direction, "event": event,
        "from": client if direction == "in" else sim, "to": sim if direction == "in" else client,
        "client": client, "company_number": sim, "extension": login,
        "start_time": _ts(e.get("event_created")) or None,
    }


def domain(raw: str) -> str:
    """'https://acme.moizvonki.ru/x' → 'acme.moizvonki.ru' (raises on junk)."""
    d = str(raw or "").strip().lower()
    d = d.removeprefix("https://").removeprefix("http://").split("/")[0].removesuffix(".moizvonki.ru")
    if not d or not all(ch.isalnum() or ch == "-" for ch in d):
        raise ProviderError("Moi Zvonki domenini kiriting: kompaniya.moizvonki.ru")
    return f"{d}.moizvonki.ru"


def call(cfg: dict, admin_key: str, action: str, *, user_name: str = "", api_key: str = "", **params) -> dict:
    user_name = user_name or str(cfg.get("login") or "").strip()
    api_key = api_key or admin_key or ""
    if not (user_name and api_key):
        raise ProviderError("Moi Zvonki administrator emaili va API kalitini kiriting")
    try:
        r = http.request("POST", f"https://{domain(cfg.get('domain'))}/api/v1",
                         json={"user_name": user_name, "api_key": api_key, "action": action, **params})
    except httpx.HTTPError as exc:
        raise ProviderError(f"Moi Zvonki'ga ulanib bo'lmadi: {exc.__class__.__name__}") from exc
    if r.status_code in (401, 403):
        raise ProviderError("Moi Zvonki email yoki API kalit noto'g'ri")
    if r.status_code != 200:
        raise ProviderError(f"Moi Zvonki xatosi {r.status_code}: {r.text[:200]}")
    try:
        return r.json() if r.content else {}
    except ValueError:
        return {}


def history(cfg: dict, key: str, since: datetime, until: datetime, max_pages: int = 50) -> list[dict]:
    out, offset = [], 0
    for _ in range(max_pages):
        body = call(cfg, key, "calls.list", from_date=int(since.timestamp()), to_date=int(until.timestamp()),
                    supervised=1, max_results=100, from_offset=offset)
        out += [record_flat(e) for e in body.get("results") or [] if isinstance(e, dict)]
        offset = _ts(body.get("results_next_offset"))
        if not offset:
            break
    return out


def subscribe(cfg: dict, key: str, url: str) -> None:
    call(cfg, key, "webhook.subscribe", hooks={h: url for h in HOOKS})


def subscribed(cfg: dict, key: str) -> dict:
    body = call(cfg, key, "webhook.list")
    return body if isinstance(body, dict) else {}


def unsubscribe(cfg: dict, key: str) -> None:
    call(cfg, key, "webhook.unsubscribe", hooks=list(HOOKS))


def make_call(cfg: dict, admin_key: str, login: str, number: str, api_key: str = "") -> None:
    """Ring `number` from the employee's own phone: the request is made as that employee."""
    call(cfg, admin_key, "calls.make_call", user_name=login, api_key=api_key, to=number)
