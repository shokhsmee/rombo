"""amoCRM as a lead source. The connection and token handling are uzbridge's (amocrm/oauth.py, client.py,
services.connect / subscribe_webhook); importing deals into leads is Rombo's own use of it (design.md §2).

Tokens live in the connection's encrypted secrets {client_secret, access_token, refresh_token}; expiry and the
account in config. Refresh tokens are single-use: refreshing happens under a row lock and is stored at once.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.chatter.services import event
from apps.core.exceptions import ValidationFailed
from apps.crm.models import Connection, IntakeLog, Lead
from apps.crm.providers import amocrm as amo
from apps.crm.providers.http import ProviderError
from apps.crm.services import live
from apps.crm.services.leads import lead_create, lead_update, set_stage

REFRESH_MARGIN = timedelta(hours=2)
HOOK_EVENTS = ["add_lead", "update_lead", "status_lead"]


def _cfg(conn) -> dict:
    return conn.config or {}


def _store_tokens(conn: Connection, tokens: dict) -> None:
    sec = conn.get_secrets()
    sec.update(access_token=tokens["access_token"], refresh_token=tokens["refresh_token"])
    conn.set_secrets(sec)
    expires = timezone.now() + timedelta(seconds=int(tokens.get("expires_in", 86400)))
    conn.config = {**_cfg(conn), "expires_at": expires.isoformat()}
    Connection.objects.filter(pk=conn.pk).update(secrets=conn.secrets, config=conn.config)


def amo_connect(conn: Connection, code: str, *, request=None) -> Connection:
    """Exchange the integration's auth code (amoCRM → integration → «Ключи и доступы», valid 20 min)."""
    from apps.crm.services.connections import _fail, _ok, amocrm_redirect_uri, webhook_url

    cfg, sec = _cfg(conn), conn.get_secrets()
    if not (cfg.get("host") and cfg.get("client_id") and sec.get("client_secret")):
        raise ValidationFailed("amoCRM manzili, Integration ID va Secret key kerak", field="client_id")
    try:
        host = amo.normalize_host(cfg["host"])
        tokens = amo.token_request(host, cfg["client_id"], sec["client_secret"], amocrm_redirect_uri(request),
                                   {"grant_type": "authorization_code", "code": code})
    except ProviderError as e:
        _fail(conn, str(e))
        raise ValidationFailed(str(e), field="code") from e
    conn.config = {**cfg, "host": host}
    _store_tokens(conn, tokens)
    account = amo_api(conn, "GET", "/api/v4/account") or {}
    conn.config = {**_cfg(conn), "account_id": account.get("id"), "subdomain": account.get("subdomain", "")}
    Connection.objects.filter(pk=conn.pk).update(config=conn.config)
    amo_pipelines(conn)
    try:
        amo_api(conn, "POST", "/api/v4/webhooks",
                json={"destination": webhook_url(conn, request), "settings": HOOK_EVENTS})
    except ProviderError as e:  # the import still works on the 10-minute pull
        _fail(conn, f"Webhook ulanmadi: {e}")
        return conn
    _ok(conn)
    return conn


def amo_token(conn: Connection, *, force: bool = False) -> str:
    """A valid access token, refreshed when it expires within 2 hours. Safe to call concurrently."""
    exp = parse_datetime(_cfg(conn).get("expires_at") or "")
    if not force and exp and exp - timezone.now() > REFRESH_MARGIN:
        return conn.get_secrets()["access_token"]
    with transaction.atomic():
        fresh = Connection.objects.select_for_update().get(pk=conn.pk)
        exp = parse_datetime((fresh.config or {}).get("expires_at") or "")
        sec = fresh.get_secrets()
        if not sec.get("refresh_token"):
            raise ProviderError("amoCRM ulanmagan — avtorizatsiya kodini kiriting")
        if not force and exp and exp - timezone.now() > REFRESH_MARGIN:  # someone else refreshed meanwhile
            conn.config, conn.secrets = fresh.config, fresh.secrets
            return sec["access_token"]
        from apps.crm.services.connections import amocrm_redirect_uri

        tokens = amo.token_request(fresh.config["host"], fresh.config["client_id"], sec["client_secret"],
                                   amocrm_redirect_uri(), {"grant_type": "refresh_token",
                                                           "refresh_token": sec["refresh_token"]})
        _store_tokens(fresh, tokens)
    conn.config, conn.secrets = fresh.config, fresh.secrets
    return tokens["access_token"]


def amo_api(conn: Connection, method: str, path: str, **kw):
    try:
        return amo.api(_cfg(conn)["host"], amo_token(conn), method, path, **kw)
    except amo.AmoError as e:
        if e.status != 401:
            raise
    return amo.api(_cfg(conn)["host"], amo_token(conn, force=True), method, path, **kw)


def amo_refresh_due() -> None:
    """crm_worker: refresh tokens that expire within 6 hours (an idle install must not lose its pair)."""
    soon = timezone.now() + timedelta(hours=6)
    for conn in Connection.objects.filter(kind=Connection.Kind.AMOCRM, enabled=True):
        exp = parse_datetime(_cfg(conn).get("expires_at") or "")
        if exp and exp < soon and conn.get_secrets().get("refresh_token"):
            try:
                amo_token(conn, force=True)
            except ProviderError as e:
                Connection.objects.filter(pk=conn.pk).update(status="error", last_error=str(e))


def amo_disconnect(conn: Connection, *, quiet: bool = False) -> None:
    from apps.crm.services.connections import webhook_url

    try:
        if conn.get_secrets().get("access_token"):
            amo_api(conn, "DELETE", "/api/v4/webhooks", json={"destination": webhook_url(conn)})
    except ProviderError:
        if not quiet:
            raise
    sec = conn.get_secrets()
    sec.pop("access_token", None)
    sec.pop("refresh_token", None)
    conn.set_secrets(sec)
    Connection.objects.filter(pk=conn.pk).update(secrets=conn.secrets, status="new")


def amo_pipelines(conn: Connection) -> list[dict]:
    body = amo_api(conn, "GET", "/api/v4/leads/pipelines")
    out = [{"id": p["id"], "name": p.get("name", ""),
            "statuses": [{"id": s["id"], "name": s.get("name", "")} for s in amo.embedded(p, "statuses")]}
           for p in amo.embedded(body, "pipelines")]
    conn.config = {**_cfg(conn), "amo_pipelines": out}
    Connection.objects.filter(pk=conn.pk).update(config=conn.config)
    return out


def amo_check(conn: Connection) -> int:
    amo_api(conn, "GET", "/api/v4/account")
    return len(amo_pipelines(conn))


# ------------------------------------------------------------------ import


def _status_name(conn: Connection, status_id) -> str:
    for p in _cfg(conn).get("amo_pipelines") or []:
        for s in p.get("statuses") or []:
            if s["id"] == status_id:
                return s["name"]
    return ""


def _target_stage(conn: Connection, pipeline, status_id):
    if status_id == amo.WON:
        return pipeline.stages.filter(is_won=True).first()
    if status_id == amo.LOST:
        return pipeline.stages.filter(is_lost=True).first()
    name = _status_name(conn, status_id).strip().lower()
    for st in pipeline.stages.filter(is_won=False, is_lost=False):
        if name and st.name.strip().lower() == name:
            return st
    return None


def _manager(conn: Connection, user_id):
    from apps.employees.models import Employee

    if user_id:
        users = dict(_cfg(conn).get("amo_users") or {})
        email = users.get(str(user_id))
        if email is None:
            try:
                email = str((amo_api(conn, "GET", f"/api/v4/users/{user_id}") or {}).get("email") or "")
            except ProviderError:
                email = ""
            users[str(user_id)] = email
            conn.config = {**_cfg(conn), "amo_users": users}
            Connection.objects.filter(pk=conn.pk).update(config=conn.config)
        if email:
            emp = (Employee.objects.filter(user__email__iexact=email).first()
                   or Employee.objects.filter(email__iexact=email).first())
            if emp:
                return emp
    mid = _cfg(conn).get("manager_id")
    return Employee.objects.filter(pk=mid).first() if mid else None


def _contact(conn: Connection, deal: dict) -> tuple[str, str]:
    contacts = amo.embedded(deal, "contacts")
    main = next((c for c in contacts if c.get("is_main")), contacts[0] if contacts else None)
    if not main:
        return "", ""
    full = main if main.get("custom_fields_values") is not None else amo_api(conn, "GET", f"/api/v4/contacts/{main['id']}")
    return amo.contact_phone_name(full or {})


def amo_import_deal(conn: Connection, deal: dict) -> tuple[Lead, bool]:
    """One amoCRM deal → its Rombo lead (made the first time, kept in step after). → (lead, created)."""
    from apps.crm.models import Pipeline
    from apps.crm.services.leads import default_pipeline

    ext = f"deal:{deal['id']}"
    cfg = _cfg(conn)
    pipeline = Pipeline.objects.filter(pk=cfg.get("pipeline_id"), is_active=True).first() or default_pipeline()
    stage = _target_stage(conn, pipeline, deal.get("status_id"))
    title = str(deal.get("name") or "").strip()[:200] or f"amoCRM #{deal['id']}"
    budget = deal.get("price") or 0
    manager = _manager(conn, deal.get("responsible_user_id"))
    tags = [t.get("name", "") for t in amo.embedded(deal, "tags")]
    log = IntakeLog.objects.filter(connection=conn, external_id=ext).select_related("lead").first()
    lead = log.lead if log and log.lead and log.lead.deleted_at is None else None
    with transaction.atomic():
        if lead is None:
            phone, name = _contact(conn, deal)
            from apps.references.models import RefItem, RefKind

            source = RefItem.objects.filter(kind=RefKind.SALES_CHANNEL,
                                            name__iexact=str(cfg.get("source") or "amoCRM")).first()
            open_stage = stage if stage is not None and not (stage.is_won or stage.is_lost) else None
            lead = lead_create(actor=None, pipeline=pipeline, stage=open_stage, title=title, phone=phone,
                               contact_name=name, budget=budget, manager=manager, source=source,
                               tags=[*tags, "amoCRM"], notify=False)
            event(lead, f"amoCRM'dan olindi: bitim #{deal['id']}")
            IntakeLog.objects.update_or_create(connection=conn, external_id=ext, defaults={"lead": lead})
            created = True
        else:
            changes = {k: v for k, v in {"title": title, "budget": budget, "manager": manager}.items()
                       if v and getattr(lead, k) != v}
            if changes:
                lead_update(lead, actor=None, **changes)
            created = False
        if stage is not None and stage.pk != lead.stage_id:
            set_stage(lead, stage, actor=None, lost_reason="amoCRM'da yopilgan" if stage.is_lost else "",
                      comment="amoCRM'da bosqich o'zgardi")
    return lead, created


def amo_sync(conn: Connection, since) -> dict:
    """Deals changed since `since` (crm_worker every 10 min, «Tarixni olish» on demand)."""
    received = new = 0
    page = 1
    while page <= 50:
        body = amo_api(conn, "GET", "/api/v4/leads", params={
            "with": "contacts", "limit": 250, "page": page, "filter[updated_at][from]": int(since.timestamp())})
        deals = amo.embedded(body, "leads")
        for d in deals:
            _, created = amo_import_deal(conn, d)
            received, new = received + 1, new + int(created)
        if not deals or not ((body or {}).get("_links") or {}).get("next"):
            break
        page += 1
    Connection.objects.filter(pk=conn.pk).update(last_event_at=timezone.now())
    return {"received": received, "new": new}


def amo_hook(conn: Connection, form: dict) -> list[int]:
    """amoCRM's webhook is unsigned form data (leads[add][0][id]=…): the token in the URL is the only proof,
    so every deal is re-read from the API before it is imported."""
    ids = []
    for k, v in form.items():
        if k.startswith("leads[") and k.endswith("][id]") and str(v).isdigit():
            ids.append(int(v))
    out = []
    for deal_id in list(dict.fromkeys(ids))[:50]:
        deal = amo_api(conn, "GET", f"/api/v4/leads/{deal_id}", params={"with": "contacts"})
        if deal:
            lead, _ = amo_import_deal(conn, deal)
            out.append(lead.pk)
    Connection.objects.filter(pk=conn.pk).update(last_event_at=timezone.now(), events_count=F("events_count") + 1)
    live.board()
    return out
