"""One call shape from whatever a PBX sends (ported from uzbridge, generic part — no UTeL / Moi Zvonki).

PBXes name the same things differently (callid / uuid / linkedid, src / caller, billsec / duration,
ANSWERED / NO ANSWER …). `normalize` reads the common spellings, works out the direction and the state,
and returns a NormalCall. Pure: no database.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime

from django.utils import timezone

from apps.crm import phones
from apps.crm.models import CallDirection, CallStatus

ALIASES = {
    "id": ("call_id", "callid", "call_uuid", "uuid", "linkedid", "uniqueid", "session_id", "sessionId", "id"),
    "event": ("event", "event_type", "state", "call_state", "action", "type"),
    "direction": ("direction", "call_direction", "call_type", "dir"),
    "from": ("from", "from_number", "caller", "caller_number", "callerid", "caller_id", "cid", "src", "source",
             "phone_from"),
    "to": ("to", "to_number", "called", "callee", "called_number", "dst", "destination", "did", "phone_to"),
    "client": ("client", "client_number", "customer", "customer_phone", "phone", "external_number"),
    "extension": ("extension", "ext", "internal", "internal_number", "operator", "agent", "user", "sip",
                  "answered_by"),
    "duration": ("billsec", "talk_time", "talk_duration", "conversation_duration", "duration_talk", "duration"),
    "wait": ("wait", "waitsec", "ring_time", "ring_duration", "wait_time"),
    "recording": ("recording_url", "record_url", "recording", "record", "record_link", "audio", "file", "link"),
    "start": ("started_at", "start_time", "start", "calldate", "call_date", "date", "created_at", "timestamp"),
    "answer": ("answered_at", "answer_time", "answer"),
    "end": ("ended_at", "end_time", "end", "hangup_time"),
    "result": ("disposition", "status", "result", "call_status", "hangup_cause"),
}

TALKING_WORDS = {"answer", "answered", "connected", "talking", "bridge", "up", "call_answered", "in_progress"}
END_WORDS = {"end", "ended", "hangup", "completed", "complete", "finished", "call_end", "hangup_complete", "cdr",
             "done"}
END_RESULTS = {"answered", "no_answer", "noanswer", "busy", "failed", "missed", "cancel", "congestion"}


@dataclass
class NormalCall:
    external_id: str
    direction: str
    status: str
    final: bool
    from_number: str = ""
    to_number: str = ""
    client_phone: str = ""
    extension: str = ""
    duration: int = 0
    wait: int = 0
    recording_url: str = ""
    started_at: datetime | None = None
    answered_at: datetime | None = None
    ended_at: datetime | None = None
    raw: dict = field(default_factory=dict)
    direction_known: bool = True  # False: the event said nothing about direction (a bare "hangup")


def _pick(d: dict, name: str):
    for k in ALIASES[name]:
        v = d.get(k)
        if v not in (None, "", []):
            return v
    return None


def _int(v) -> int:
    try:
        return max(0, int(float(v)))
    except (TypeError, ValueError):
        if isinstance(v, str) and ":" in v:  # "00:02:31"
            secs = 0
            for part in v.split(":"):
                secs = secs * 60 + (int(part) if part.isdigit() else 0)
            return secs
        return 0


def _aware(t: datetime) -> datetime:
    # a PBX in Samarkand writes local wall time without an offset
    return t if t.tzinfo else timezone.make_aware(t)


def _time(v) -> datetime | None:
    if v in (None, ""):
        return None
    if isinstance(v, int | float) or (isinstance(v, str) and v.isdigit()):
        n = float(v)
        return datetime.fromtimestamp(n / 1000 if n > 1e12 else n, UTC)
    s = str(v).strip().replace("T", " ").replace("Z", "+00:00")
    for fmt in ("%Y-%m-%d %H:%M:%S%z", "%Y-%m-%d %H:%M:%S.%f%z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f",
                "%d.%m.%Y %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return _aware(datetime.strptime(s, fmt))
        except ValueError:
            continue
    try:
        return _aware(datetime.fromisoformat(s))
    except ValueError:
        return None


def _direction(raw_dir, src: str, dst: str) -> str:
    d = str(raw_dir or "").lower()
    if d in ("in", "inbound", "incoming", "input", "1", "входящий"):
        return CallDirection.IN
    if d in ("out", "outbound", "outgoing", "output", "2", "исходящий"):
        return CallDirection.OUT
    if d in ("internal", "local", "3"):
        return CallDirection.INTERNAL
    if phones.is_internal(src) and phones.is_internal(dst):
        return CallDirection.INTERNAL
    if phones.is_internal(src) and not phones.is_internal(dst):
        return CallDirection.OUT
    return CallDirection.IN


def normalize(payload: dict, *, company_numbers: list[str] | None = None) -> NormalCall | None:
    if not isinstance(payload, dict):
        return None
    d = {**payload, **(payload.get("call") if isinstance(payload.get("call"), dict) else {})}
    ext_id = _pick(d, "id")
    src = str(_pick(d, "from") or "")
    dst = str(_pick(d, "to") or "")
    if ext_id is None and not (src or dst):
        return None
    direction = _direction(_pick(d, "direction"), src, dst)
    direction_known = bool(_pick(d, "direction") or src or dst)
    extension = str(_pick(d, "extension") or "")
    client = str(_pick(d, "client") or "")
    if not client:
        client = dst if direction == CallDirection.OUT else src
    own = {phones.key(n) for n in [str(d.get("company_number") or ""), *(company_numbers or [])] if phones.key(n)}
    if phones.key(client) in own:  # the company's own line is never the client
        other = src if client == dst else dst
        client = other if phones.key(other) not in own else ""
    if not extension:
        inside = src if direction == CallDirection.OUT else dst
        extension = inside if phones.is_internal(inside) else ""
    duration = _int(_pick(d, "duration"))
    event = str(_pick(d, "event") or "").lower()
    result = str(_pick(d, "result") or "").lower().replace("-", "_").replace(" ", "_")
    ended_at = _time(_pick(d, "end"))

    final = event in END_WORDS or bool(ended_at) or result in END_RESULTS or (not event and duration > 0)
    if final:
        if result == "busy":
            status = CallStatus.BUSY
        elif result in ("failed", "congestion", "chanunavail"):
            status = CallStatus.FAILED
        elif duration > 0 or result in ("answered", "answer", "success", "completed"):
            status = CallStatus.ANSWERED
        else:
            status = CallStatus.MISSED if direction == CallDirection.IN else CallStatus.NO_ANSWER
    elif event in TALKING_WORDS or result in ("answered", "up"):
        status = CallStatus.TALKING
    else:
        status = CallStatus.RINGING

    started = _time(_pick(d, "start"))
    return NormalCall(
        external_id=str(ext_id or f"{src}-{dst}-{started.isoformat() if started else ''}"),
        direction=direction,
        status=status,
        final=final,
        from_number=src[:40],
        to_number=dst[:40],
        client_phone=phones.normalize(client)[:20] if not phones.is_internal(client) else "",
        extension=extension[:40],
        duration=duration,
        wait=_int(_pick(d, "wait")),
        recording_url=str(_pick(d, "recording") or "")[:500],
        started_at=started,
        answered_at=_time(_pick(d, "answer")),
        ended_at=ended_at,
        raw=payload,
        direction_known=direction_known,
    )
