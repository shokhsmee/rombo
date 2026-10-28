"""Connections: telephony providers and lead sources — settings, secrets, check, history pull, webhook URL
(uzbridge crm/api.py connection endpoints + telephony.sync).

Secrets are one encrypted JSON blob; a form value is a secret when the catalog marks it so. Saving an empty
secret keeps the stored one; `clear_secrets` removes named ones.
"""

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import ValidationFailed
from apps.crm import catalog
from apps.crm.models import Call, Connection, new_token
from apps.crm.providers import moizvonki, utel
from apps.crm.providers.http import ProviderError
from apps.crm.providers.rest import RestClient, as_list
from apps.crm.services import live

SYNC_EVERY = timedelta(minutes=10)

# ------------------------------------------------------------------ URLs


def public_base(request=None) -> str:
    if settings.PUBLIC_BASE_URL:
        return settings.PUBLIC_BASE_URL
    return request.build_absolute_uri("/").rstrip("/") if request is not None else "http://localhost:8000"


def webhook_url(conn: Connection, request=None) -> str:
    base = public_base(request) + "/api/v1"
    hook = catalog.KIND_BY_KEY[conn.kind]["webhook"]
    if hook == "telephony":
        return f"{base}/telephony/hook/{conn.token}/"
    if hook == "amocrm":
        return f"{base}/crm/hooks/amocrm/{conn.token}/"
    return f"{base}/crm/hooks/leads/{conn.token}/"


def amocrm_redirect_uri(request=None) -> str:
    return public_base(request) + "/api/v1/crm/hooks/amocrm/redirect/"


# ------------------------------------------------------------------ settings


def _apply(conn: Connection, config: dict | None, secrets: dict | None, clear: list | None) -> dict:
    """Split the form into config / secrets by the catalog. Returns transient values (an amoCRM auth code)."""
    spec = catalog.KIND_BY_KEY[conn.kind]
    transient = {f["key"] for f in spec["fields"] if f.get("transient")}
    pub, sec = catalog.public_keys(conn.kind), catalog.secret_keys(conn.kind)
    cfg = dict(conn.config or {})
    for k, v in (config or {}).items():
        if k in pub:
            cfg[k] = v.strip() if isinstance(v, str) else v
    base = str(cfg.get("base_url") or "").strip()
    if base and not base.startswith(("http://", "https://")):
        raise ValidationFailed("Manzil http(s):// bilan boshlanishi kerak", field="base_url")
    if conn.kind == Connection.Kind.MOIZVONKI and cfg.get("domain"):
        try:
            cfg["domain"] = moizvonki.domain(cfg["domain"])
        except ProviderError as e:
            raise ValidationFailed(str(e), field="domain") from e
    stored = conn.get_secrets()
    for k in clear or []:
        stored.pop(k, None)
    out = {}
    for k, v in (secrets or {}).items():
        if k in transient and v:
            out[k] = str(v).strip()
        elif k in sec and v not in (None, ""):
            stored[k] = str(v).strip()
            if conn.kind == Connection.Kind.UTEL and k == "password" and not (secrets or {}).get("api_key"):
                stored.pop("api_key", None)  # a new password: the cached token is fetched again
    conn.config = cfg
    conn.set_secrets(stored)
    return out


def _after_save(conn: Connection, transient: dict, request=None) -> None:
    if conn.kind == Connection.Kind.MOIZVONKI:
        _subscribe_moizvonki(conn, request)
    if conn.kind == Connection.Kind.AMOCRM and transient.get("code"):
        from apps.crm.services.amocrm import amo_connect

        amo_connect(conn, transient["code"], request=request)


@transaction.atomic
def connection_create(*, actor, kind: str, name: str = "", enabled: bool = True, config=None, secrets=None,
                      request=None, **_) -> Connection:
    if kind not in catalog.KIND_BY_KEY:
        raise ValidationFailed("Noma'lum ulanish turi", field="kind")
    conn = Connection(kind=kind, name=(name or catalog.KIND_BY_KEY[kind]["name"])[:100], enabled=enabled,
                      config=catalog.defaults(kind))
    transient = _apply(conn, config, secrets, None)
    conn.stamp(actor, created=True)
    conn.save()
    _after_save(conn, transient, request)
    return conn


@transaction.atomic
def connection_update(conn: Connection, *, actor, config=None, secrets=None, clear_secrets=None, request=None,
                      **fields) -> Connection:
    for k in ("name", "enabled"):
        if k in fields:
            setattr(conn, k, fields[k])
    transient = _apply(conn, config, secrets, clear_secrets)
    conn.stamp(actor)
    conn.save()
    _after_save(conn, transient, request)
    return conn


def connection_delete(conn: Connection, *, actor) -> None:
    if conn.kind == Connection.Kind.MOIZVONKI and conn.status == "ok":
        try:
            moizvonki.unsubscribe(conn.config, conn.get_secrets().get("api_key", ""))
        except ProviderError:
            pass  # best effort: the account may be gone already
    if conn.kind == Connection.Kind.AMOCRM:
        from apps.crm.services.amocrm import amo_disconnect

        amo_disconnect(conn, quiet=True)
    conn.delete()


def connection_rotate_token(conn: Connection, *, actor, request=None) -> Connection:
    conn.token = new_token()
    conn.save(update_fields=["token", "updated_at"])
    if conn.kind == Connection.Kind.MOIZVONKI:
        _subscribe_moizvonki(conn, request)
    return conn


def _fail(conn: Connection, msg: str) -> None:
    Connection.objects.filter(pk=conn.pk).update(status="error", last_error=msg[:2000])
    conn.status, conn.last_error = "error", msg


def _ok(conn: Connection, **extra) -> None:
    Connection.objects.filter(pk=conn.pk).update(status="ok", last_error="", **extra)
    conn.status, conn.last_error = "ok", ""


def _subscribe_moizvonki(conn: Connection, request=None) -> None:
    """Point the account's call events at our webhook; a failure shows on the connection, never blocks a save."""
    cfg, key = conn.config or {}, conn.get_secrets().get("api_key", "")
    if not (conn.enabled and cfg.get("domain") and cfg.get("login") and key):
        return
    try:
        moizvonki.subscribe(cfg, key, webhook_url(conn, request))
        _ok(conn)
    except ProviderError as e:
        _fail(conn, str(e))


# ------------------------------------------------------------------ check and history


def utel_token(conn: Connection) -> str:
    """The saved UTeL token, or one got with the email + password (cached: it never expires)."""
    sec = conn.get_secrets()
    if sec.get("api_key"):
        return sec["api_key"]
    email, password = (conn.config or {}).get("login"), sec.get("password")
    if not (email and password):
        raise ProviderError("UTeL email va parolini yoki API tokenni kiriting")
    tok = utel.login(conn.config, email, password)
    conn.set_secrets({**sec, "api_key": tok})
    Connection.objects.filter(pk=conn.pk).update(secrets=conn.secrets)
    return tok


def _history(conn: Connection, since, until, max_pages: int | None = None) -> list[dict]:
    cfg, sec = conn.config or {}, conn.get_secrets()
    if conn.kind == Connection.Kind.UTEL:
        return utel.history(cfg, utel_token(conn), timezone.localtime(since), timezone.localtime(until),
                            **({"max_pages": max_pages} if max_pages else {}))
    if conn.kind == Connection.Kind.MOIZVONKI:
        return moizvonki.history(cfg, sec.get("api_key", ""), since, until,
                                 **({"max_pages": max_pages} if max_pages else {}))
    path = str(cfg.get("history_path") or "").strip()
    if not path:
        raise ProviderError("«Tarix yo'li» kiritilmagan")
    return RestClient(conn).list(path, since=timezone.localtime(since), until=timezone.localtime(until))


def can_sync(conn: Connection) -> bool:
    cfg = conn.config or {}
    if conn.kind == Connection.Kind.UTEL:
        return bool(cfg.get("base_url"))
    if conn.kind == Connection.Kind.MOIZVONKI:
        return bool(cfg.get("domain"))
    if conn.kind == Connection.Kind.AMOCRM:
        return bool(conn.get_secrets().get("access_token"))
    return bool(cfg.get("history_path") or cfg.get("leads_path"))


def connection_check(conn: Connection, *, actor=None, request=None) -> dict:
    """Ask the provider for a little history: proves the address and the keys. Errors go on the connection."""
    try:
        now = timezone.now()
        if conn.kind == Connection.Kind.AMOCRM:
            from apps.crm.services.amocrm import amo_check

            n = amo_check(conn)
        elif conn.kind in (Connection.Kind.WEBHOOK, Connection.Kind.YUBORAMAN) and not (conn.config or {}).get(
                "base_url"):
            _ok(conn)
            return {"ok": True, "records": conn.events_count, "webhook": True}
        elif conn.kind == Connection.Kind.UTEL:
            n = len(_history(conn, now - timedelta(hours=1), now, max_pages=1))
        elif conn.kind == Connection.Kind.MOIZVONKI:
            n = len(_history(conn, now - timedelta(days=1), now, max_pages=1))
            hooks = moizvonki.subscribed(conn.config, conn.get_secrets().get("api_key", ""))
            if any(str(v) != webhook_url(conn, request) for v in hooks.values()) or not hooks:
                _subscribe_moizvonki(conn, request)
        else:
            path = (conn.config or {}).get("history_path") or (conn.config or {}).get("leads_path") or ""
            n = len(as_list(RestClient(conn).request("GET", path)))
    except ProviderError as e:
        _fail(conn, str(e))
        raise ValidationFailed(str(e)) from e
    _ok(conn)
    return {"ok": True, "records": n}


def connection_sync(conn: Connection, *, days: int = 3, actor=None) -> dict:
    """Pull history since the last pull (1 h overlap) or `days` back the first time. Calls only link to
    existing leads; lead sources go through intake (dedupe by their id)."""
    if not can_sync(conn):
        raise ValidationFailed("Bu ulanishdan tarix olinmaydi")
    until = timezone.now()
    since = conn.last_sync_at - timedelta(hours=1) if conn.last_sync_at else until - timedelta(days=max(1, min(days, 90)))
    try:
        if conn.kind == Connection.Kind.AMOCRM:
            from apps.crm.services.amocrm import amo_sync

            result = amo_sync(conn, since)
        elif conn.is_telephony:
            from apps.crm.services.telephony import ingest

            records = _history(conn, since, until)
            before = Call.objects.count()
            for rec in records:
                ingest(rec, conn=conn, source=Call.Source.SYNC, final=True)
            result = {"received": len(records), "new": Call.objects.count() - before}
        else:
            from apps.crm.services.intake import sync_leads

            result = sync_leads(conn, since, until)
    except ProviderError as e:
        _fail(conn, str(e))
        live.sync_done(conn.pk, {"ok": False, "error": str(e)})
        raise ValidationFailed(str(e)) from e
    _ok(conn, last_sync_at=until)
    live.sync_done(conn.pk, {"ok": True, **result})
    live.board()
    return result


def sync_due() -> list[int]:
    """Connections whose periodic pull is due (crm_worker, every 10 minutes)."""
    due = timezone.now() - SYNC_EVERY
    return [c.pk for c in Connection.objects.filter(enabled=True) if can_sync(c)
            and (c.last_sync_at is None or c.last_sync_at < due)]
