"""Lead sources: a website form, Facebook / Instagram forms behind a service, Yuboraman — whatever shape the
request has, it becomes a lead (uzbridge crm/intake.py).

flatten → recognise name / phone / email / text by the common key spellings → dedupe by the sender's id →
route to the number's open lead or a new one → the request goes into the lead's history.
"""

import json

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.chatter.services import event
from apps.crm import phones
from apps.crm.models import Connection, IntakeLog, Lead
from apps.crm.providers.rest import RestClient
from apps.crm.services import live
from apps.crm.services.routing import route

ID_KEYS = ("id", "lead_id", "leadgen_id", "request_id", "order_id", "external_id", "uuid")
NAME_KEYS = ("name", "full_name", "fullname", "fio", "f_i_o", "firstname", "first_name", "ism", "ismi",
             "client_name", "contact_name", "lead_name", "username", "user_name", "имя", "ф.и.о", "фио")
LAST_KEYS = ("last_name", "lastname", "surname", "familiya", "фамилия")
PHONE_KEYS = ("phone", "phone_number", "phonenumber", "tel", "telefon", "telephone", "mobile", "mobile_number",
              "number", "raqam", "telefon_raqami", "contact_phone", "телефон", "номер")
EMAIL_KEYS = ("email", "e_mail", "mail", "почта")
TEXT_KEYS = ("message", "comment", "izoh", "text", "note", "description", "question", "savol")
NOISE = {"title", "source", "tags", "token", "secret", "signature", "access_token", "test"}
WRAPPERS = ("data", "payload", "lead", "json", "body", "result", "contact", "client")
MAX_PER_REQUEST = 50  # the link is public: one request can't make an unbounded number of leads


def _norm(k) -> str:
    return str(k).strip().lower().replace("-", "_").replace(" ", "_")


def flatten(payload, out: dict | None = None) -> dict:
    """Any shape → {normalized_key: text}; the outermost value of a key wins. Facebook field_data items
    ({"name", "values"}) become name → "v1, v2"; wrapper keys holding a JSON string are parsed."""
    out = {} if out is None else out
    if isinstance(payload, list):
        for x in payload:
            flatten(x, out)
        return out
    if not isinstance(payload, dict):
        return out
    if "name" in payload and isinstance(payload.get("values"), list) and len(payload) <= 3:
        out.setdefault(_norm(payload["name"]), ", ".join(str(v) for v in payload["values"]))
        return out
    nested = []
    for k, v in payload.items():
        key = _norm(k)
        if isinstance(v, str) and key in WRAPPERS and v.strip()[:1] in ("{", "["):
            try:
                v = json.loads(v)
            except ValueError:
                pass
        if isinstance(v, dict | list):
            nested.append(v)
        elif v not in (None, ""):
            out.setdefault(key, str(v).strip())
    for v in nested:
        flatten(v, out)
    return out


def _first(flat: dict, keys) -> str:
    for k in keys:
        if flat.get(k):
            return flat[k]
    return ""


def intake(conn: Connection, payload: dict, *, actor=None) -> dict:
    flat = flatten(payload)
    ext_id = _first(flat, ID_KEYS)[:120]
    if ext_id and IntakeLog.objects.filter(connection=conn, external_id=ext_id).exists():
        log = IntakeLog.objects.get(connection=conn, external_id=ext_id)
        return {"lead_id": log.lead_id, "duplicate": True, "already": True}
    name, phone, email = _first(flat, NAME_KEYS), _first(flat, PHONE_KEYS), _first(flat, EMAIL_KEYS)
    last = _first(flat, LAST_KEYS)
    if last and last not in name:
        name = f"{name} {last}".strip()
    used = {*ID_KEYS, *NAME_KEYS, *LAST_KEYS, *PHONE_KEYS, *EMAIL_KEYS, *TEXT_KEYS, *NOISE}
    extras = {k: v for k, v in flat.items() if k not in used}
    text = _first(flat, TEXT_KEYS)
    cfg = conn.config or {}
    src = str(cfg.get("source") or conn.name)[:60]
    warn = ""
    if not (name or phone or email):
        if not flat or "test" in flat:
            return {"ok": True, "test": True}  # the sender's ping when the link is saved
        warn = "⚠ Ism, telefon yoki email topilmadi — maydonlarni tekshiring"
    body = "\n".join(p for p in [warn, text, *(f"{k}: {v}" for k, v in extras.items()), email and f"email: {email}"]
                     if p)
    tags = [t.strip() for t in str(cfg.get("tags") or "").split(",") if t.strip()]
    from apps.employees.models import Employee

    manager = Employee.objects.filter(pk=cfg.get("manager_id")).first() if cfg.get("manager_id") else None
    from apps.references.models import RefItem, RefKind

    source = RefItem.objects.filter(kind=RefKind.SALES_CHANNEL, name__iexact=src).first()
    title = flat.get("title") or (f"{name or phones.pretty(phone) or email} — {src}" if (name or phone or email)
                                  else "Tekshirish kerak")
    try:
        with transaction.atomic():
            r = route(phone=phone, name=name, email=email, unknown="create_lead",
                      duplicate="always_new" if cfg.get("duplicate") == "always_new" else "open_lead",
                      title=title, pipeline_id=cfg.get("pipeline_id"), stage_id=cfg.get("stage_id"),
                      manager=manager, source=source, tags=tags, note=f"Lid {src} orqali keldi", actor=actor)
            lead = r.lead
            if lead is None:  # nothing to route by: still never lose a paid request
                from apps.crm.services.routing import new_lead

                lead = new_lead(title=title, manager=manager, source=source, tags=tags,
                                pipeline_id=cfg.get("pipeline_id"), stage_id=cfg.get("stage_id"), actor=actor)
            head = "Ariza" if r.created_lead or r.lead is None else "Yana ariza"
            event(lead, f"{head} ({src})" + (f":\n{body}" if body else ""), actor=actor)
            if ext_id:
                IntakeLog.objects.create(connection=conn, external_id=ext_id, lead=lead, duplicate=not r.created_lead)
            Lead.objects.filter(pk=lead.pk).update(updated_at=timezone.now())
            Connection.objects.filter(pk=conn.pk).update(last_event_at=timezone.now(), events_count=F("events_count") + 1,
                                                         status="ok", last_error="")
    except IntegrityError:  # the same request twice at once
        return {"lead_id": None, "duplicate": True, "already": True}
    live.board(lead.pipeline_id)
    return {"lead_id": lead.pk, "duplicate": not r.created_lead and r.lead is not None,
            "client_id": r.client.pk if r.client else None}


def intake_many(conn: Connection, body) -> list[dict]:
    items = [x for x in body if isinstance(x, dict)] if isinstance(body, list) else [body]
    return [intake(conn, p) for p in items[:MAX_PER_REQUEST] if isinstance(p, dict)]


def sync_leads(conn: Connection, since, until) -> dict:
    """Pull mode: GET base_url + leads_path for the window, every row through intake()."""
    path = str((conn.config or {}).get("leads_path") or "").strip()
    rows = RestClient(conn).list(path, since=timezone.localtime(since), until=timezone.localtime(until))
    out = [intake(conn, row) for row in rows]
    return {"received": len(rows), "new": sum(1 for x in out if x.get("lead_id") and not x.get("duplicate")),
            "duplicates": sum(1 for x in out if x.get("duplicate"))}
