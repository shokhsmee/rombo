import json
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.access.models import Role
from apps.crm.models import Call, Connection, CrmSettings, Extension, GoogleAccount, TelephonySettings
from apps.users.models import User
from conftest import API, login


def _conn(admin, kind="pbx", **body):
    r = admin.post(f"{API}/crm/connections/", {"kind": kind, **body}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _hook(api, conn, payload, fmt="json"):
    return api.post(f"{API}/telephony/hook/{conn['webhook_url'].rstrip('/').rsplit('/', 1)[1]}/", payload, format=fmt)


def _operator(admin, number="101", **ext):
    u = User.objects.create_user(username=f"op{number}", password="op-pass-123", first_name="Operator",
                                 email=f"op{number}@rombo.uz")
    r = admin.post(f"{API}/telephony/extensions/", {"user_id": u.pk, "number": number, "sip_password": "s3cret", **ext},
                   format="json")
    assert r.status_code == 201, r.content
    assert "sip_password" not in r.json() and r.json()["has_password"] is True
    return u


def _history(admin, model, rid):
    return admin.get(f"{API}/chatter/", {"model": model, "res_id": rid}).json()


def _rules(**kw):
    TelephonySettings.objects.update_or_create(pk=1, defaults=kw)


# ---------------------------------------------------------------- generic PBX


def test_webhook_rejects_wrong_or_disabled_token(api, admin):
    conn = _conn(admin)
    assert api.post(f"{API}/telephony/hook/wrong/", {"call_id": "x"}, format="json").status_code == 404
    admin.patch(f"{API}/crm/connections/{conn['id']}/", {"enabled": False}, format="json")
    assert _hook(api, conn, {"call_id": "x"}).status_code == 404


def test_missed_call_from_unknown_number_makes_lead_and_callback(api, admin):
    conn = _conn(admin)
    op = _operator(admin)
    assert _hook(api, conn, {"call_id": "a1", "event": "ringing", "from": "+998901112233", "to": "101"}).status_code == 200
    call = Call.objects.get(external_id="a1")
    assert (call.direction, call.status, call.user_id, call.connection_id) == ("in", "ringing", op.pk, conn["id"])

    _hook(api, conn, {"call_id": "a1", "event": "hangup"})
    call.refresh_from_db()
    assert call.status == "missed" and call.lead_id and call.created_lead
    lead = admin.get(f"{API}/crm/leads/{call.lead_id}/").json()
    assert lead["phone"] == "+998 90 111 22 33" and lead["open_tasks"] == 1 and lead["missed_calls"] == 1
    assert "Kiruvchi qo'ng'iroq · +998 90 111 22 33 · o'tkazib yuborildi" in [
        m["body"] for m in _history(admin, "crm.lead", lead["id"])]

    _hook(api, conn, {"call_id": "a1", "event": "ringing", "from": "+998901112233", "to": "101"})  # late ringing
    call.refresh_from_db()
    assert call.status == "missed"

    # they get through: same lead, the call-back task is done
    _hook(api, conn, {"call_id": "a2", "from": "901112233", "to": "101", "disposition": "ANSWERED", "billsec": 95})
    back = Call.objects.get(external_id="a2")
    assert back.lead_id == call.lead_id and back.status == "answered" and back.duration == 95
    lead = admin.get(f"{API}/crm/leads/{call.lead_id}/").json()
    assert lead["open_tasks"] == 0 and lead["calls_count"] == 2
    assert Connection.objects.get(pk=conn["id"]).events_count == 3  # the late ringing changed nothing


def test_call_from_client_goes_to_client_history_form_post(api, admin):
    conn = _conn(admin)
    c = admin.post(f"{API}/clients/", {"name": "Mega Qurilish", "phone": "+998 71 200 30 40"}, format="json").json()
    _rules(duplicate="contact_only")  # a known client: link, no lead
    _hook(api, conn, {"call_id": "b1", "from": "712003040", "to": "102", "billsec": "31", "event": "hangup"},
          fmt="multipart")
    call = Call.objects.get(external_id="b1")
    assert call.client_id == c["id"] and call.lead_id is None
    assert _history(admin, "clients.client", c["id"])[0]["body"] == "Kiruvchi qo'ng'iroq · +998 71 200 30 40 · 0:31"


def test_company_number_is_never_the_client(api, admin):
    conn = _conn(admin, config={"numbers": "+998 66 200 00 00"})
    _hook(api, conn, {"call_id": "c1", "direction": "in", "from": "+998662000000", "to": "+998935554433", "billsec": 5})
    assert Call.objects.get(external_id="c1").client_phone == "+998935554433"


def test_rules_outgoing_unknown_makes_client_and_short_calls_stay_out(api, admin):
    conn = _conn(admin)
    _rules(outgoing_unknown="create_contact", min_duration=10)
    _hook(api, conn, {"call_id": "o1", "direction": "out", "from": "101", "to": "+998937770011", "billsec": 4})
    call = Call.objects.get(external_id="o1")
    assert call.lead_id is None and call.client and call.client.phone == "+998 93 777 00 11"
    assert [m["body"] for m in _history(admin, "clients.client", call.client_id)] == ["Mijoz yaratildi"]


def test_rules_fixed_manager_title_template_and_stage(api, admin):
    conn = _conn(admin)
    from apps.employees.models import Employee

    emp = Employee.objects.create(last_name="Karimova", first_name="Dilnoza")
    stage = admin.get(f"{API}/crm/pipelines/").json()[0]["stages"][1]
    r = admin.patch(f"{API}/telephony/settings/", {"responsible": "fixed", "fixed_manager_id": emp.pk,
                                                    "lead_title": "Kiruvchi {phone}", "stage_id": stage["id"],
                                                    "tags": ["qo'ng'iroq"]}, format="json")
    assert r.status_code == 200, r.content
    _hook(api, conn, {"call_id": "f1", "from": "+998901234567", "to": "101", "billsec": 40})
    lead = admin.get(f"{API}/crm/leads/{Call.objects.get(external_id='f1').lead_id}/").json()
    assert lead["title"] == "Kiruvchi +998 90 123 45 67" and lead["manager"]["id"] == emp.pk
    assert lead["stage"]["id"] == stage["id"] and lead["tags"] == ["qo'ng'iroq"]


def test_softphone_reports_its_call_when_no_pbx_webhook(api, admin):
    op = _operator(admin)
    op.roles.add(Role.objects.get(name="Savdo menejeri"))  # telephony.view
    me = login(api, op.username, "op-pass-123")
    phone = me.get(f"{API}/telephony/me/").json()["phone"]
    assert phone["extension"] == "101" and phone["sip_password"] == ""  # browser phone off: no secret
    for ev in ({"event": "ringing", "direction": "out", "from": "101", "to": "901112233"}, {"event": "answer"},
               {"event": "hangup", "billsec": 40}):
        assert me.post(f"{API}/telephony/softphone/", {"call_id": "s1", **ev}, format="json").status_code == 200
    call = Call.objects.get(external_id=f"sp-{op.pk}-s1")
    assert (call.direction, call.status, call.duration, call.user_id) == ("out", "answered", 40, op.pk)
    assert me.get(f"{API}/telephony/calls/live/").json()[0]["id"] == call.pk

    conn = _conn(admin)  # a live PBX webhook owns the records from now on
    _hook(api, conn, {"call_id": "p1", "from": "+998901112299", "to": "101", "event": "ringing"})
    r = me.post(f"{API}/telephony/softphone/", {"call_id": "s2", "event": "ringing", "direction": "out", "to": "1"},
                format="json")
    assert r.json() == {"id": None}


def test_sip_password_encrypted_and_only_for_its_owner(api, admin):
    conn = _conn(admin, config={"sip_wss": "wss://pbx.rombo.uz:8089"})
    op = _operator(admin, connection_id=conn["id"])
    ext = admin.get(f"{API}/telephony/extensions/").json()[0]
    admin.patch(f"{API}/telephony/extensions/{ext['id']}/", {"softphone": True, "sip_password": ""}, format="json")
    from django.db import connection as db

    with db.cursor() as cur:
        cur.execute("select sip_password from crm_extension")
        assert cur.fetchone()[0].startswith("gAAAA")  # a Fernet token, not the password
    assert admin.get(f"{API}/telephony/me/").json()["phone"] is None  # admin has no extension
    op.is_superuser = True
    op.save()
    phone = login(api, op.username, "op-pass-123").get(f"{API}/telephony/me/").json()["phone"]
    assert phone["sip_password"] == "s3cret"  # an empty field kept the saved password
    assert phone["wss"] == "wss://pbx.rombo.uz:8089/ws" and phone["sip_login"] == "101"


def test_connection_secrets_are_masked_and_token_rotates(api, admin, fake_http):
    conn = _conn(admin, kind="pbx", config={"base_url": "https://pbx.example.uz", "history_path": "/calls"},
                 secrets={"api_key": "key-123456789"})
    assert conn["secrets"] == {"api_key": "••••••••6789"}
    assert "key-123456789" not in json.dumps(admin.get(f"{API}/crm/connections/").json())
    old = conn["webhook_url"]
    new = admin.post(f"{API}/crm/connections/{conn['id']}/token/").json()["webhook_url"]
    assert new != old and _hook(api, conn, {"call_id": "z"}).status_code == 404


def test_create_lead_from_call_and_stats(api, admin):
    conn = _conn(admin)
    _rules(incoming_unknown="nothing")
    _hook(api, conn, {"call_id": "d1", "from": "+998977776655", "to": "103", "billsec": 12, "event": "hangup"})
    call = admin.get(f"{API}/telephony/calls/").json()["items"][0]
    assert call["lead"] is None
    linked = admin.post(f"{API}/telephony/calls/{call['id']}/lead/").json()
    assert linked["lead"]["name"] == "Qo'ng'iroq: +998 97 777 66 55"
    assert admin.post(f"{API}/telephony/calls/{call['id']}/lead/").status_code == 409
    stats = admin.get(f"{API}/telephony/calls/stats/").json()
    assert stats["incoming"] == 1 and stats["answered"] == 1 and stats["talk_seconds"] == 12
    a = admin.get(f"{API}/telephony/calls/analytics/").json()
    assert a["totals"]["in"] == 1 and a["totals"]["answer_rate"] == 100 and len(a["heatmap"]["calls"]) == 7


def test_pages_are_guarded(api, admin):
    User.objects.create_user(username="nobody", password="nobody-123")
    other = login(api, "nobody", "nobody-123")
    assert other.get(f"{API}/crm/leads/").status_code == 403
    assert other.get(f"{API}/telephony/calls/").status_code == 403
    assert other.get(f"{API}/telephony/me/").status_code == 403
    assert other.get(f"{API}/crm/connections/").status_code == 403


# ---------------------------------------------------------------- UTeL


UTEL = "https://api.cc1.utel.uz/api/v1"


def _utel_event(name, cid="u-1", **cdr):
    return {"time": "12:00:00", "data": {"name": name, "domain": "https://api.cc1.utel.uz", "call": {
        "id": cid, "src": "+998901110000", "connected": name == "call_ended" and cdr.get("conversation", 0) > 0,
        "cdr": {"type": "incoming", "src": "+998901110000", "dst": "101", "external_number": "+998662220000",
                "started_at": "2026-10-29 10:00:00", **cdr}}}}


def test_utel_webhook_and_company_line_learned(api, admin):
    conn = _conn(admin, kind="utel", config={"base_url": "https://api.cc1.utel.uz"})
    op = _operator(admin)
    _hook(api, conn, _utel_event("call_started"))
    _hook(api, conn, _utel_event("dial_ended"))  # a dial leg: ignored
    call = Call.objects.get(external_id="u-1")
    assert (call.status, call.direction, call.user_id) == ("ringing", "in", op.pk)
    _hook(api, conn, _utel_event("call_ended", conversation=65, ended_at="2026-10-29 10:01:10", last_answered="101"))
    call.refresh_from_db()
    assert (call.status, call.duration, call.client_phone) == ("answered", 65, "+998901110000")
    assert "+998662220000" in Connection.objects.get(pk=conn["id"]).config["numbers"]


def test_utel_history_sync_caches_token_and_only_links(api, admin, fake_http):
    conn = _conn(admin, kind="utel", config={"base_url": "https://api.cc1.utel.uz", "login": "boss@rombo.uz"},
                 secrets={"password": "pw"})
    fake_http.on("POST", f"{UTEL}/auth/login", {"result": {"access_token": "T0K"}})
    fake_http.on("GET", f"{UTEL}/call-history", {"data": [
        {"call_id": "h1", "date_time": "2026-10-29 09:00:00", "src": "+998935550000", "dst": "102",
         "external_number": "+998662220000", "duration": 70, "conversation": 60,
         "type": {"number": 1, "name": "incoming"}, "status": {"number": 1, "name": "answered"},
         "recorded_file_url": "https://rec.utel.uz/h1.mp3"}], "meta": {"last_page": 1}})
    r = admin.post(f"{API}/crm/connections/{conn['id']}/sync/?days=2")
    assert r.status_code == 200, r.content
    assert r.json() == {"received": 1, "new": 1}
    call = Call.objects.get(external_id="h1")
    assert (call.source, call.duration, call.wait, call.lead_id) == ("sync", 60, 10, None)  # history makes no leads
    assert Connection.objects.get(pk=conn["id"]).get_secrets()["api_key"] == "T0K"
    assert fake_http.requests[-1].headers["Authorization"] == "Bearer T0K"
    fake_http.on("GET", f"{UTEL}/call-history", (401, {}))
    bad = admin.post(f"{API}/crm/connections/{conn['id']}/check/")
    assert bad.status_code == 400 and Connection.objects.get(pk=conn["id"]).status == "error"


# ---------------------------------------------------------------- Moi Zvonki

MZ = "https://acme.moizvonki.ru/api/v1"


def test_moizvonki_subscribes_on_save_and_reads_webhooks(api, admin, fake_http):
    sent = []
    fake_http.on("POST", MZ, lambda req: (sent.append(json.loads(req.content)) or (200, {})))
    conn = _conn(admin, kind="moizvonki", config={"domain": "https://acme.moizvonki.ru/", "login": "boss@rombo.uz"},
                 secrets={"api_key": "MZKEY"})
    assert conn["config"]["domain"] == "acme.moizvonki.ru" and conn["status"] == "ok"
    assert sent[0]["action"] == "webhook.subscribe" and set(sent[0]["hooks"]) == {"call.start", "call.answer",
                                                                                    "call.finish"}
    op = _operator(admin, number="op101@rombo.uz")
    ev = {"direction": 0, "client_number": "+998901230000", "event_pbx_call_id": "mz1", "src_number": "+998900000001"}
    _hook(api, conn, {"webhook": {"action": "call.start", "user_login": "OP101@rombo.uz"}, "event": ev})
    _hook(api, conn, {"webhook": {"action": "call.finish", "user_login": "op101@rombo.uz"}, "event": {
        **ev, "start_time": 1000, "answer_time": 1010, "end_time": 1070, "answered": 1}})
    call = Call.objects.get(external_id="mz1")
    assert (call.status, call.duration, call.wait, call.user_id) == ("answered", 60, 10, op.pk)


def test_moizvonki_click_to_call_rings_employee_mobile(api, admin, fake_http):
    sent = []
    fake_http.on("POST", MZ, lambda req: (sent.append(json.loads(req.content)) or (200, {})))
    conn = _conn(admin, kind="moizvonki", config={"domain": "acme", "login": "boss@rombo.uz"},
                 secrets={"api_key": "MZKEY"})
    op = _operator(admin, number="op@rombo.uz", connection_id=conn["id"])
    Extension.objects.filter(user=op).update(sip_password="")  # no own key: the admin key is used
    op.is_superuser = True
    op.save()
    r = login(api, op.username, "op-pass-123").post(f"{API}/telephony/dial/", {"number": "90 111 22 33"},
                                                     format="json")
    assert r.json() == {"ok": True, "mobile": True}
    assert sent[-1] == {"user_name": "op@rombo.uz", "api_key": "MZKEY", "action": "calls.make_call",
                        "to": "+998901112233"}


def test_dial_without_provider_asks_for_browser_phone(api, admin):
    _conn(admin)
    _operator(admin)
    u = User.objects.get(username="op101")
    u.is_superuser = True
    u.save()
    r = login(api, "op101", "op-pass-123").post(f"{API}/telephony/dial/", {"number": "901112233"}, format="json")
    assert r.status_code == 400 and "brauzer telefonini" in r.json()["error"]["message"]


# ---------------------------------------------------------------- recordings → Google Drive


@pytest.fixture
def drive(settings):
    settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET = "gid", "gsecret"
    GoogleAccount.objects.create(pk=1, email="rombo@gmail.com", refresh_token="R", access_token="A",
                                 expires_at=timezone.now() + timedelta(hours=1))
    CrmSettings.objects.update_or_create(pk=1, defaults={"recordings_enabled": True, "recordings_folder_id": "F1",
                                                         "recordings_since": timezone.now() - timedelta(days=1)})


def test_recording_archived_to_drive_with_retry(api, admin, fake_http, drive):
    from apps.crm.services.recordings import archive_due

    conn = _conn(admin)
    ready = {"ok": False}
    fake_http.on("GET", "https://pbx.example.uz/rec/r1.mp3",
                 lambda req: (200, b"ID3audio") if ready["ok"] else (404, b""))
    fake_http.on("GET", "https://www.googleapis.com/drive/v3/files/F1", {"id": "F1", "trashed": False})
    fake_http.on("POST", "https://www.googleapis.com/upload/drive/v3/files", {"id": "DRV1"})
    _hook(api, conn, {"call_id": "r1", "from": "+998901000000", "to": "101", "billsec": 30,
                      "recording_url": "https://pbx.example.uz/rec/r1.mp3"})
    call = Call.objects.get(external_id="r1")
    Call.objects.filter(pk=call.pk).update(recording_next_at=timezone.now())  # on_commit doesn't run in tests
    assert archive_due() == 0  # not ready yet: retried later
    call.refresh_from_db()
    assert call.recording_attempts == 1 and call.recording_next_at > timezone.now() and not call.recording_error
    ready["ok"] = True
    Call.objects.filter(pk=call.pk).update(recording_next_at=timezone.now())
    assert archive_due() == 1
    call.refresh_from_db()
    assert call.recording_file_id == "DRV1"
    link = admin.get(f"{API}/telephony/calls/{call.pk}/").json()["recording_url"]
    assert link.startswith("/api/v1/telephony/recordings/") and "pbx.example.uz" not in link
    fake_http.on("GET", "https://www.googleapis.com/drive/v3/files/DRV1", lambda req: (
        __import__("httpx").Response(206, content=b"ID3a", headers={"content-type": "audio/mpeg",
                                                                     "content-range": "bytes 0-3/8"})))
    r = api.get(link, HTTP_RANGE="bytes=0-3")
    assert r.status_code == 206 and b"".join(r.streaming_content) == b"ID3a"
    assert api.get("/api/v1/telephony/recordings/bad-token/").status_code == 404


def test_recordings_status_and_google_not_configured(admin):
    st = admin.get(f"{API}/telephony/recordings/").json()
    assert st["configured"] is False and st["connected"] is False
    r = admin.post(f"{API}/telephony/recordings/?do=connect", {}, format="json")
    assert r.status_code == 400 and "GOOGLE_CLIENT_ID" in r.json()["error"]["message"]


def test_crm_repair_utel_dry_run_then_apply(api, admin):
    from django.core.management import call_command

    conn = _conn(admin, kind="utel", config={"base_url": "https://api.cc1.utel.uz"})
    _hook(api, conn, {"call_id": "x1", "direction": "in", "from": "+998662220000", "to": "101", "billsec": 5})
    bad = Call.objects.get(external_id="x1")
    assert bad.client_phone == "+998662220000" and bad.lead_id  # the line wasn't known yet
    c = Connection.objects.get(pk=conn["id"])
    c.config = {**c.config, "numbers": "+998662220000"}
    c.save()
    call_command("crm_repair_utel")  # dry run changes nothing
    assert Call.objects.get(pk=bad.pk).client_phone == "+998662220000"
    call_command("crm_repair_utel", apply=True)
    bad.refresh_from_db()
    from apps.crm.models import Lead

    assert bad.client_phone == "" and bad.lead_id is None and Lead.objects.count() == 0
