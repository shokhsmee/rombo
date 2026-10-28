import json
from datetime import timedelta
from urllib.parse import parse_qs

from django.utils import timezone

from apps.crm.models import Connection, IntakeLog, Lead
from apps.crm.services.amocrm import amo_token
from conftest import API


def _conn(admin, kind="webhook", **body):
    r = admin.post(f"{API}/crm/connections/", {"kind": kind, **body}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _url(conn) -> str:
    return conn["webhook_url"].split("http://testserver", 1)[-1]


def _history(admin, rid):
    return admin.get(f"{API}/chatter/", {"model": "crm.lead", "res_id": rid}).json()


# ---------------------------------------------------------------- website form / Yuboraman


def test_form_post_becomes_a_lead_and_is_deduped(api, admin):
    conn = _conn(admin, name="Sayt", config={"source": "Sayt", "tags": "sayt, aksiya"})
    r = api.post(_url(conn), {"id": "f-1", "Ism": "Botir", "Telefon": "90 555 44 33", "comment": "3 ta deraza",
                              "xona": "3"}, format="multipart")
    assert r.status_code == 200, r.content
    lead_id = r.json()["leads"][0]["lead_id"]
    lead = admin.get(f"{API}/crm/leads/{lead_id}/").json()
    assert lead["title"] == "Botir — Sayt" and lead["phone"] == "+998 90 555 44 33"
    assert lead["contact_name"] == "Botir" and lead["tags"] == ["sayt", "aksiya"]
    assert any(m["body"].startswith("Ariza (Sayt):\n3 ta deraza\nxona: 3") for m in _history(admin, lead_id))
    again = api.post(_url(conn), {"id": "f-1", "Ism": "Botir", "Telefon": "905554433"}, format="multipart").json()
    assert again["leads"][0] == {"lead_id": lead_id, "duplicate": True, "already": True}
    # a new request from the same number goes into the open lead
    more = api.post(_url(conn), {"id": "f-2", "phone": "+998905554433", "message": "Narx?"}, format="json").json()
    assert more["leads"][0]["lead_id"] == lead_id and more["leads"][0]["duplicate"] is True
    assert Lead.objects.count() == 1 and Connection.objects.get(pk=conn["id"]).events_count == 2


def test_facebook_field_data_json_in_a_form_field_and_list(api, admin):
    conn = _conn(admin, config={"duplicate": "always_new"})
    fb = {"leadgen_id": "L9", "field_data": [{"name": "full_name", "values": ["Aziza Karimova"]},
                                             {"name": "phone_number", "values": ["+998933330000"]}]}
    wrapped = {"data": json.dumps({"name": "Olim", "phone": "+998977770000"})}
    r = api.post(_url(conn), [fb, wrapped], format="json").json()
    titles = sorted(Lead.objects.values_list("contact_name", flat=True))
    assert len(r["leads"]) == 2 and titles == ["Aziza Karimova", "Olim"]
    assert IntakeLog.objects.filter(external_id="L9").exists()


def test_ping_check_and_unrecognised_payload(api, admin):
    conn = _conn(admin)
    assert api.get(_url(conn) + "?hub.challenge=abc123").content == b"abc123"
    assert api.get(_url(conn)).json()["ok"] is True
    assert api.post(_url(conn), {"test": "1"}, format="json").json()["leads"] == [{"ok": True, "test": True}]
    weird = api.post(_url(conn), {"what": "is this"}, format="json").json()["leads"][0]
    lead = Lead.objects.get(pk=weird["lead_id"])
    assert lead.title == "Tekshirish kerak"
    assert "maydonlarni tekshiring" in _history(admin, lead.pk)[0]["body"]


def test_lead_source_tokens_dont_open_telephony(api, admin):
    conn = _conn(admin)
    token = _url(conn).rstrip("/").rsplit("/", 1)[1]
    assert api.post(f"{API}/telephony/hook/{token}/", {"call_id": "x"}, format="json").status_code == 404


def test_yuboraman_pull(api, admin, fake_http):
    conn = _conn(admin, kind="yuboraman", config={"base_url": "https://api.yuboraman.uz", "leads_path": "/leads",
                                                   "auth_mode": "header", "key_name": "X-Key"},
                 secrets={"api_key": "YK"})
    fake_http.on("GET", "https://api.yuboraman.uz/leads", {"data": {"items": [
        {"id": 7, "name": "Sardor", "phone": "+998901010101"}, {"id": 8, "name": "Laylo", "phone": "+998902020202"}]}})
    r = admin.post(f"{API}/crm/connections/{conn['id']}/sync/").json()
    assert r == {"received": 2, "new": 2, "duplicates": 0}
    assert fake_http.requests[0].headers["X-Key"] == "YK" and "date_from" in str(fake_http.requests[0].url)
    assert admin.post(f"{API}/crm/connections/{conn['id']}/sync/").json()["duplicates"] == 2


# ---------------------------------------------------------------- amoCRM


AMO = "https://acme.amocrm.ru"


def _amo_api(fake_http, deals):
    # prefix match, latest first: the list goes first so /leads/pipelines (added after) wins over it
    fake_http.on("GET", f"{AMO}/api/v4/leads", {"_embedded": {"leads": deals}, "_links": {}})
    fake_http.on("GET", f"{AMO}/api/v4/account", {"id": 31, "subdomain": "acme"})
    fake_http.on("GET", f"{AMO}/api/v4/leads/pipelines", {"_embedded": {"pipelines": [
        {"id": 5, "name": "Voronka", "_embedded": {"statuses": [{"id": 51, "name": "Yangi"}, {"id": 52, "name": "Taklif"},
                                                                 {"id": 142, "name": "Успешно"}]}}]}})
    fake_http.on("POST", f"{AMO}/api/v4/webhooks", {"destination": "x"})
    fake_http.on("GET", f"{AMO}/api/v4/contacts/700", {"id": 700, "name": "Jamshid Aliyev", "custom_fields_values": [
        {"field_code": "PHONE", "values": [{"value": "+998 91 700 70 70"}]}]})
    fake_http.on("GET", f"{AMO}/api/v4/users/9", {"id": 9, "email": "nobody@rombo.uz"})


def _deal(status=52, **kw):
    return {"id": 1001, "name": "Kottej derazalari", "price": 45000000, "status_id": status, "pipeline_id": 5,
            "responsible_user_id": 9, "_embedded": {"contacts": [{"id": 700, "is_main": True}],
                                                    "tags": [{"name": "VIP"}]}, **kw}


def _amo_conn(admin, fake_http, deals=()):
    tokens = []
    fake_http.on("POST", f"{AMO}/oauth2/access_token", lambda req: (
        tokens.append(json.loads(req.content)) or (200, {"access_token": f"AT{len(tokens)}", "refresh_token": f"RT{len(tokens)}",
                                                          "expires_in": 86400})))
    _amo_api(fake_http, list(deals))
    conn = _conn(admin, kind="amocrm", config={"host": "acme", "client_id": "cid"},
                 secrets={"client_secret": "csecret", "code": "AUTHCODE"})
    return conn, tokens


def test_amocrm_connect_imports_deals_and_keeps_them_in_step(api, admin, fake_http):
    conn, tokens = _amo_conn(admin, fake_http, [_deal()])
    assert tokens[0]["grant_type"] == "authorization_code" and tokens[0]["code"] == "AUTHCODE"
    assert conn["status"] == "ok" and conn["config"]["host"] == "acme.amocrm.ru"
    assert "code" not in conn["secrets"]  # the auth code is used once, never stored
    stored = Connection.objects.get(pk=conn["id"]).get_secrets()
    assert stored["access_token"] == "AT1" and stored["client_secret"] == "csecret"

    r = admin.post(f"{API}/crm/connections/{conn['id']}/sync/").json()
    assert r == {"received": 1, "new": 1}
    lead = Lead.objects.get()
    assert (lead.title, lead.phone, lead.contact_name, lead.stage.name) == (
        "Kottej derazalari", "+998 91 700 70 70", "Jamshid Aliyev", "Taklif")
    assert lead.budget == 45000000 and "VIP" in lead.tags and "amoCRM" in lead.tags

    # the deal is won in amoCRM: the webhook re-reads it and the lead follows
    fake_http.on("GET", f"{AMO}/api/v4/leads/1001", _deal(status=142, price=50000000))
    token = _url(conn)  # the amoCRM card shows the Redirect URI; the hook URL is by token
    hook = f"{API}/crm/hooks/amocrm/{Connection.objects.get(pk=conn['id']).token}/"
    assert token.endswith("/crm/hooks/amocrm/redirect/")
    r = api.post(hook, "leads[status][0][id]=1001&leads[status][0][status_id]=142",
                 content_type="application/x-www-form-urlencoded")
    assert r.status_code == 200, r.content
    lead.refresh_from_db()
    assert lead.status == "won" and lead.budget == 50000000 and Lead.objects.count() == 1


def test_amocrm_token_refreshes_once_before_expiry(api, admin, fake_http):
    conn, tokens = _amo_conn(admin, fake_http)
    c = Connection.objects.get(pk=conn["id"])
    c.config = {**c.config, "expires_at": (timezone.now() + timedelta(minutes=30)).isoformat()}
    c.save()
    assert amo_token(c) == "AT2" and tokens[-1] == {**tokens[-1], "grant_type": "refresh_token", "refresh_token": "RT1"}
    assert amo_token(Connection.objects.get(pk=conn["id"])) == "AT2"  # fresh now: no second refresh
    assert len(tokens) == 2


def test_amocrm_bad_code_shows_on_the_connection(admin, fake_http):
    fake_http.on("POST", f"{AMO}/oauth2/access_token", (400, {"hint": "Authorization code has been revoked"}))
    r = admin.post(f"{API}/crm/connections/", {"kind": "amocrm", "config": {"host": "acme.amocrm.ru", "client_id": "c"},
                                                "secrets": {"client_secret": "s", "code": "OLD"}}, format="json")
    assert r.status_code == 400 and "eskirgan" in r.json()["error"]["message"]


def test_amocrm_host_must_be_amocrm(admin, fake_http):
    r = admin.post(f"{API}/crm/connections/", {"kind": "amocrm", "config": {"host": "evil.example.com",
                                                                             "client_id": "c"},
                                                "secrets": {"client_secret": "s", "code": "X"}}, format="json")
    assert r.status_code == 400 and not fake_http.requests


def test_amocrm_redirect_page_shows_the_code(api):
    page = api.get(f"{API}/crm/hooks/amocrm/redirect/?code=abc").content.decode()
    assert "abc" in page and parse_qs("code=abc")
