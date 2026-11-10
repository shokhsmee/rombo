import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.maintenance import bot
from apps.maintenance.models import BotKind, BotUser, Master, ServiceRequest
from apps.maintenance.webapp import validate_init_data
from conftest import API

CLIENT_TOKEN = "111:client-token"
MASTER_TOKEN = "222:master-token"
TG = "https://api.telegram.org"


@pytest.fixture(autouse=True)
def _bots(settings):
    settings.SERVICE_CLIENT_BOT_TOKEN = CLIENT_TOKEN
    settings.SERVICE_MASTER_BOT_TOKEN = MASTER_TOKEN
    settings.SERVICE_WEBHOOK_SECRET = "hook-secret"
    settings.PUBLIC_BASE_URL = "https://erp.rombo.uz"
    settings.SERVICE_WEBAPP_URL = ""


@pytest.fixture
def tg(fake_http):
    """Telegram Bot API: every call answers ok; `tg.sent(kind)` = the texts sent by that bot."""
    fake_http.on("POST", TG, lambda req: (200, {"ok": True, "result": {"username": "rombo_bot"}}))

    def sent(kind=None):
        token = {BotKind.CLIENT: CLIENT_TOKEN, BotKind.MASTER: MASTER_TOKEN}.get(kind, "")
        return [json.loads(r.content) for r in fake_http.requests
                if r.url.path.endswith("/sendMessage") and token in str(r.url)]

    fake_http.sent = sent
    return fake_http


def init_data(user_id: int, token: str, *, age: int = 0, **user) -> str:
    fields = {"auth_date": str(int(time.time()) - age), "query_id": "AAH",
              "user": json.dumps({"id": user_id, "first_name": "Ali", **user})}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def app(api, user_id: int, token: str):
    from rest_framework.test import APIClient

    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"tma {init_data(user_id, token)}")
    return c


def contact_update(user_id: int, phone: str, *, own: bool = True) -> dict:
    return {"update_id": 1, "message": {
        "message_id": 1, "chat": {"id": user_id, "type": "private"},
        "from": {"id": user_id, "first_name": "Vali", "last_name": "Karimov"},
        "contact": {"phone_number": phone, "user_id": user_id if own else 999, "first_name": "Vali",
                    "last_name": "Karimov"}}}


def _master(admin, name="Usta Ali", phone="+998 90 111 22 33"):
    r = admin.post(f"{API}/maintenance/masters/", {"name": name, "phone": phone}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _client(admin, name="Mijoz Bobur", phone="+998 91 555 66 77"):
    r = admin.post(f"{API}/clients/", {"name": name, "phone": phone}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _request(admin, client_id, **extra):
    body = {"client_id": client_id, "kind": "adjust", "description": "Deraza yopilmayapti", **extra}
    r = admin.post(f"{API}/maintenance/requests/", body, format="json")
    assert r.status_code == 201, r.content
    return r.json()


# ------------------------------------------------------------------ initData


def test_init_data_signature_and_age():
    good = init_data(42, CLIENT_TOKEN)
    assert validate_init_data(good, CLIENT_TOKEN)["id"] == 42

    from rest_framework.exceptions import AuthenticationFailed

    with pytest.raises(AuthenticationFailed):
        validate_init_data(good, MASTER_TOKEN)  # signed for the other bot
    with pytest.raises(AuthenticationFailed):
        validate_init_data(good.replace("Ali", "Bob"), CLIENT_TOKEN)  # tampered
    with pytest.raises(AuthenticationFailed):
        validate_init_data(init_data(42, CLIENT_TOKEN, age=2 * 86400), CLIENT_TOKEN)  # stale


# ------------------------------------------------------------------ ERP flow


def test_master_phone_is_normalised_and_unique(admin):
    m = _master(admin, phone="90 111 22 33")
    assert m["phone"] == "+998901112233" and m["code"] == "US-0001"
    dup = admin.post(f"{API}/maintenance/masters/", {"name": "Boshqa", "phone": "+998901112233"},
                     format="json")
    assert dup.status_code == 409


def test_request_flow_from_the_erp(admin):
    m = _master(admin)
    c = _client(admin)
    r = _request(admin, c["id"])
    assert r["code"].startswith("SV-") and r["status"] == "new" and r["phone"] == "+998 91 555 66 77"
    rid = r["id"]

    skip = admin.post(f"{API}/maintenance/requests/{rid}/status/", {"status": "done"}, format="json")
    assert skip.status_code == 400

    a = admin.post(f"{API}/maintenance/requests/{rid}/assign/", {"master_id": m["id"],
                                                                 "scheduled_at": "2026-11-10T10:00:00+05:00"},
                   format="json")
    assert a.status_code == 200, a.content
    assert (a.json()["status"], a.json()["master"]["id"]) == ("assigned", m["id"])

    no_reason = admin.post(f"{API}/maintenance/requests/{rid}/status/", {"status": "cancelled"},
                           format="json")
    assert no_reason.json()["error"]["field"] == "comment"

    back = admin.post(f"{API}/maintenance/requests/{rid}/status/", {"status": "new", "comment": "boshqa kun"},
                      format="json").json()
    assert (back["status"], back["master"]) == ("new", None)

    assert admin.delete(f"{API}/maintenance/requests/{rid}/").status_code == 204

    masters = admin.get(f"{API}/maintenance/masters/").json()["items"]
    assert masters[0]["active_jobs"] == 0


def test_project_must_be_the_clients_and_makes_warranty(admin):
    c = _client(admin)
    other = _client(admin, "Boshqa mijoz", "+998 93 000 00 01")
    p = admin.post(f"{API}/projects/", {"name": "Uy", "client_id": c["id"], "object_address": "Chilonzor 5"},
                   format="json").json()
    bad = admin.post(f"{API}/maintenance/requests/", {"client_id": other["id"], "project_id": p["id"],
                                                      "description": "x"}, format="json")
    assert bad.status_code == 400
    r = _request(admin, c["id"], project_id=p["id"])
    assert (r["is_warranty"], r["address"]) == (True, "Chilonzor 5")


# ------------------------------------------------------------------ bots


def test_client_bot_links_phone_to_existing_client(api, admin, tg):
    c = _client(admin)
    bot.handle_update(BotKind.CLIENT, contact_update(500, "998915556677"))
    bu = BotUser.objects.get(bot=BotKind.CLIENT, tg_id=500)
    assert bu.client_id == c["id"] and bu.phone == "+998915556677"
    assert "Tayyor" in tg.sent(BotKind.CLIENT)[0]["text"]


def test_client_bot_creates_a_new_client_and_refuses_someone_elses_contact(api, tg):
    bot.handle_update(BotKind.CLIENT, contact_update(501, "+998977777777", own=False))
    assert BotUser.objects.get(tg_id=501).client is None

    bot.handle_update(BotKind.CLIENT, contact_update(501, "+998977777777"))
    bu = BotUser.objects.get(tg_id=501)
    assert bu.client.name == "Vali Karimov" and bu.client.code.startswith("MJ-")


def test_master_bot_only_knows_registered_masters(admin, tg):
    bot.handle_update(BotKind.MASTER, contact_update(600, "+998 99 999 99 99"))
    assert BotUser.objects.get(bot=BotKind.MASTER, tg_id=600).master is None
    assert "ro'yxatida yo'q" in tg.sent(BotKind.MASTER)[-1]["text"]

    m = _master(admin, phone="+998 99 999 99 99")
    bot.handle_update(BotKind.MASTER, contact_update(600, "+998999999999"))
    assert BotUser.objects.get(bot=BotKind.MASTER, tg_id=600).master_id == m["id"]


def test_assign_notifies_master_who_accepts_from_the_button(admin, tg, django_capture_on_commit_callbacks):
    m = _master(admin)
    c = _client(admin)
    bot.handle_update(BotKind.MASTER, contact_update(700, "+998901112233"))
    bot.handle_update(BotKind.CLIENT, contact_update(701, "+998915556677"))
    r = _request(admin, c["id"])

    with django_capture_on_commit_callbacks(execute=True):
        admin.post(f"{API}/maintenance/requests/{r['id']}/assign/", {"master_id": m["id"]}, format="json")
    job = tg.sent(BotKind.MASTER)[-1]
    assert "Yangi ish" in job["text"] and r["code"] in job["text"]
    assert job["reply_markup"]["inline_keyboard"][0][0]["callback_data"] == f"acc:{r['id']}"
    assert "usta biriktirildi" in tg.sent(BotKind.CLIENT)[-1]["text"]

    with django_capture_on_commit_callbacks(execute=True):
        bot.handle_update(BotKind.MASTER, {"update_id": 2, "callback_query": {
            "id": "cb1", "from": {"id": 700}, "data": f"acc:{r['id']}",
            "message": {"message_id": 5, "chat": {"id": 700}}}})
    assert ServiceRequest.objects.get(pk=r["id"]).status == "accepted"
    assert "qabul qildi" in tg.sent(BotKind.CLIENT)[-1]["text"]

    # someone else's button press does nothing
    bot.handle_update(BotKind.MASTER, contact_update(702, "+998 90 000 00 00"))
    bot.handle_update(BotKind.MASTER, {"update_id": 3, "callback_query": {
        "id": "cb2", "from": {"id": 702}, "data": f"dec:{r['id']}"}})
    assert ServiceRequest.objects.get(pk=r["id"]).status == "accepted"


def test_webhook_needs_the_secret(api, tg):
    url = f"{API}/maintenance/bot/client/webhook/"
    assert api.post(url, contact_update(800, "+998911111111"), format="json").status_code == 403
    ok = api.post(url, contact_update(800, "+998911111111"), format="json",
                  HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="hook-secret")
    assert ok.status_code == 200 and BotUser.objects.get(tg_id=800).client is not None


# ------------------------------------------------------------------ Mini Apps


def test_client_and_master_mini_apps_end_to_end(api, admin, tg):
    m = _master(admin)
    bot.handle_update(BotKind.MASTER, contact_update(900, "+998901112233"))
    bot.handle_update(BotKind.CLIENT, contact_update(901, "+998915556677"))
    client_app, master_app = app(api, 901, CLIENT_TOKEN), app(api, 900, MASTER_TOKEN)

    assert client_app.get(f"{API}/maintenance/app/client/me/").json()["name"] == "Vali Karimov"
    photo = SimpleUploadedFile("deraza.jpg", b"\xff\xd8\xff fake jpeg", content_type="image/jpeg")
    r = client_app.post(f"{API}/maintenance/app/client/requests/", {
        "kind": "hardware", "description": "Ruchka sindi", "address": "Yunusobod 7",
        "latitude": "41.3654321987",
        "longitude": "69.2845678912", "photos": [photo]}, format="multipart")
    assert r.status_code == 201, r.content
    req = r.json()
    assert req["status"] == "new" and len(req["photos"]) == 1
    assert ServiceRequest.objects.get(pk=req["id"]).source == "bot"
    assert api.get(req["photos"][0]["url"]).status_code == 200
    assert api.get(req["photos"][0]["url"].split("?")[0] + "?s=forged").status_code == 404

    # the master sees nothing until the office assigns
    assert master_app.get(f"{API}/maintenance/app/master/jobs/").json() == []
    admin.post(f"{API}/maintenance/requests/{req['id']}/assign/", {"master_id": m["id"]}, format="json")
    jobs = master_app.get(f"{API}/maintenance/app/master/jobs/").json()
    assert [j["id"] for j in jobs] == [req["id"]] and jobs[0]["client"]["name"] == "Vali Karimov"

    base = f"{API}/maintenance/app/master/jobs/{req['id']}"
    assert master_app.post(f"{base}/finish/", {"report": "x"}, format="json").status_code == 409
    assert master_app.post(f"{base}/start/").json()["status"] == "in_progress"
    assert master_app.post(f"{base}/finish/", {"report": ""}, format="json").status_code == 400
    done = master_app.post(f"{base}/finish/", {"report": "Ruchka almashtirildi"}, format="json")
    assert done.json()["status"] == "done"

    cbase = f"{API}/maintenance/app/client/requests/{req['id']}"
    assert client_app.post(f"{cbase}/cancel/").status_code == 409
    rated = client_app.post(f"{cbase}/rate/", {"rating": 5, "feedback": "Zo'r"}, format="json").json()
    assert (rated["status"], rated["rating"]) == ("closed", 5)
    assert master_app.get(f"{API}/maintenance/app/master/me/").json()["rating"] == 5


def test_mini_app_isolation_and_auth(api, admin, tg):
    c1 = _client(admin)
    r = _request(admin, c1["id"])
    bot.handle_update(BotKind.CLIENT, contact_update(950, "+998 95 000 00 01"))  # a different client
    stranger = app(api, 950, CLIENT_TOKEN)
    assert stranger.get(f"{API}/maintenance/app/client/requests/{r['id']}/").status_code == 404
    assert stranger.get(f"{API}/maintenance/app/client/requests/").json() == []

    assert api.get(f"{API}/maintenance/app/client/me/").status_code in (401, 403)
    # a client's initData doesn't open the master app
    assert app(api, 950, CLIENT_TOKEN).get(f"{API}/maintenance/app/master/me/").status_code in (401, 403)
    # opened the app before sharing a phone
    assert app(api, 951, CLIENT_TOKEN).get(f"{API}/maintenance/app/client/me/").status_code == 403


def test_inactive_master_with_open_jobs(admin):
    m = _master(admin)
    c = _client(admin)
    r = _request(admin, c["id"])
    admin.post(f"{API}/maintenance/requests/{r['id']}/assign/", {"master_id": m["id"]}, format="json")
    off = admin.patch(f"{API}/maintenance/masters/{m['id']}/", {"is_active": False}, format="json")
    assert off.status_code == 409
    assert Master.objects.get(pk=m["id"]).is_active
