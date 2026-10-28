"""UTeL (udocs.utel.uz): its webhook envelope and its API, turned into our flat call shape (uzbridge crm/utel.py).

Webhook (UTeL cabinet → Modules → Webhook → our URL): POST {"time", "data": {"name": "<event>", "domain":
"https://api.ccN.utel.uz", "call": {"id": uuid, "src", "exten", "connected", "cdr": {"type", "src", "dst",
"external_number", "started_at", "ended_at", "conversation", "record_filename", "last_answered"}}}}.
Events: call_started → dial_started → dial_answered → dial_ended → call_ended → call_saved; the last carries
"call_history" (call_id, date_time, src, dst, external_number, duration, conversation, type, status,
recorded_file_url).

API: base = the domain + /api/v1; POST /auth/login {email, password} → result.access_token (never expires);
GET /call-history?filter[from]=Y-m-d H:i:s&filter[to]=…&per_page=300&page=N → {data, meta: {last_page}}.
"""

from datetime import datetime

import httpx

from apps.crm.providers import http
from apps.crm.providers.http import ProviderError

EVENTS = {
    "call_started": "ringing",
    "dial_started": "ringing",
    "dial_answered": "answer",
    "dial_ended": "",  # one leg of the dial is over, not the call
    "call_blind_transferred": "",
    "call_attended_transferred": "",
    "call_ended": "hangup",
    "call_saved": "hangup",
}
TYPES = {"incoming": "in", "outgoing": "out", "internal": "internal", "1": "in", "2": "out", "3": "internal"}


def is_utel(payload: dict) -> bool:
    d = payload.get("data")
    return isinstance(d, dict) and isinstance(d.get("name"), str) and (
        "call" in d or "call_history" in d or "call_first" in d)


def _type(v) -> str:
    if isinstance(v, dict):
        v = v.get("number") if v.get("number") is not None else v.get("name")
    return TYPES.get(str(v or "").lower(), "")


def history_flat(h: dict) -> dict:
    """One CallHistoryIndexResource → our flat call."""
    direction = _type(h.get("type"))
    st = h.get("status") or {}
    answered = (str(st.get("number")) == "1" or str(st.get("name", "")).strip().lower() == "answered"
                or int(h.get("conversation") or 0) > 0)
    return {
        "call_id": h.get("call_id") or h.get("id"),
        "direction": direction,
        "event": "hangup",
        "from": h.get("src"),
        "to": h.get("dst"),
        # external_number is the company's own line (its DID), not the client: the client is src / dst
        "client": h.get("src") if direction == "in" else h.get("dst"),
        "company_number": h.get("external_number") or "",
        "extension": h.get("dst") if direction == "in" else h.get("src"),
        "billsec": int(h.get("conversation") or 0),
        "wait": max(0, int(h.get("duration") or 0) - int(h.get("conversation") or 0)),
        "disposition": "ANSWERED" if answered else "NO ANSWER",
        "start_time": h.get("date_time"),
        "recording_url": h.get("recorded_file_url") or "",
    }


def webhook_flat(payload: dict) -> dict | None:
    """A UTeL webhook → our flat call, or None for events that don't change the call (a dial leg ending)."""
    d = payload["data"]
    name = d.get("name", "")
    if name == "call_saved" and isinstance(d.get("call_history"), dict):
        return history_flat(d["call_history"])
    event = EVENTS.get(name)
    if not event:
        return None
    call = d.get("call") or d.get("call_first") or {}
    cdr = call.get("cdr") or {}
    direction = _type(cdr.get("type"))
    dest = d.get("destChannel") or {}
    ext = (cdr.get("last_answered")
           or ((dest.get("caller") or {}).get("number") if direction == "in" else cdr.get("src")) or "")
    flat = {
        "call_id": call.get("id"),
        "direction": direction,
        "event": event,
        "from": cdr.get("src") or call.get("src"),
        "to": cdr.get("dst") or call.get("exten"),
        "client": (cdr.get("src") or call.get("src")) if direction == "in" else cdr.get("dst"),
        "company_number": cdr.get("external_number") or "",
        "extension": ext if len(str(ext)) <= 5 else "",
        "start_time": cdr.get("started_at"),
    }
    if event == "hangup":
        flat["billsec"] = int(cdr.get("conversation") or 0)
        flat["end_time"] = cdr.get("ended_at")
        flat["disposition"] = "ANSWERED" if call.get("connected") or flat["billsec"] else "NO ANSWER"
    return flat


def company_number(payload: dict) -> str:
    """The company's own line a UTeL event / history record names (never the client)."""
    d = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    return str(payload.get("company_number") or ((d.get("call") or {}).get("cdr") or {}).get("external_number")
               or (d.get("call_history") or {}).get("external_number") or "")


# ------------------------------------------------------------------ API


def base(cfg: dict) -> str:
    b = str(cfg.get("base_url") or "").strip().rstrip("/")
    if not b.startswith("https://"):
        raise ProviderError("UTeL manzilini kiriting: https://api.ccNNN.utel.uz")
    return b if b.endswith("/api/v1") else b + "/api/v1"


def login(cfg: dict, email: str, password: str) -> str:
    """An API token from the UTeL email + password (it never expires)."""
    try:
        r = http.request("POST", base(cfg) + "/auth/login", json={"email": email, "password": password},
                         headers={"Accept": "application/json"})
    except httpx.HTTPError as exc:
        raise ProviderError(f"UTeL'ga ulanib bo'lmadi: {exc.__class__.__name__}") from exc
    if r.status_code >= 400:
        raise ProviderError(f"UTeL kirish rad etildi ({r.status_code}): email yoki parol noto'g'ri")
    tok = ((r.json() or {}).get("result") or {}).get("access_token")
    if not tok:
        raise ProviderError("UTeL token qaytarmadi")
    return tok


def history(cfg: dict, token: str, since: datetime, until: datetime, max_pages: int = 20) -> list[dict]:
    """Ended calls in [since, until] (local wall time, as UTeL keeps it)."""
    b, out, page = base(cfg), [], 1
    while page <= max_pages:
        try:
            r = http.request("GET", b + "/call-history", params={
                "filter[from]": since.strftime("%Y-%m-%d %H:%M:%S"),
                "filter[to]": until.strftime("%Y-%m-%d %H:%M:%S"),
                "per_page": 300, "page": page, "sort": "id",
            }, headers={"Accept": "application/json", "Authorization": f"Bearer {token}"})
        except httpx.HTTPError as exc:
            raise ProviderError(f"UTeL'ga ulanib bo'lmadi: {exc.__class__.__name__}") from exc
        if r.status_code in (401, 403):
            raise ProviderError("UTeL token yaroqsiz — email va parolni qayta kiriting")
        if r.status_code >= 400:
            raise ProviderError(f"UTeL xatosi {r.status_code}: {r.text[:200]}")
        body = r.json() or {}
        out += [history_flat(h) for h in body.get("data") or [] if isinstance(h, dict)]
        if page >= int((body.get("meta") or {}).get("last_page") or 1):
            break
        page += 1
    return out
