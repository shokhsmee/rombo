from datetime import timedelta

from django.utils import timezone

from apps.access.models import Role
from apps.crm import phones
from apps.crm.models import Call, TelephonySettings
from apps.users.models import User
from conftest import API, login


def _lead(admin, **body):
    r = admin.post(f"{API}/crm/leads/", {"title": "Uy derazalari", "phone": "+998 90 111 22 33", **body},
                   format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _history(admin, model, rid):
    return admin.get(f"{API}/chatter/", {"model": model, "res_id": rid}).json()


def _stages(admin):
    p = admin.get(f"{API}/crm/pipelines/").json()[0]
    return {s["name"]: s for s in p["stages"]}


def _token():
    return TelephonySettings.objects.get_or_create(pk=1)[0].webhook_token


# ---------------------------------------------------------------- phones


def test_phone_forms_meet_on_one_key():
    for raw in ("+998 90 123-45-67", "998901234567", "901234567", "0901234567"):
        assert phones.normalize(raw) == "+998901234567"
        assert phones.key(raw) == "901234567"
    assert phones.is_internal("101")
    assert phones.pretty("901234567") == "+998 90 123 45 67"


# ---------------------------------------------------------------- pipeline and leads


def test_default_pipeline_made_on_first_visit(admin):
    pipelines = admin.get(f"{API}/crm/pipelines/").json()
    assert len(pipelines) == 1
    names = [s["name"] for s in pipelines[0]["stages"]]
    assert names == ["Yangi", "Bog'lanildi", "O'lchov", "Taklif", "Shartnoma", "Yutildi", "Rad etildi"]
    assert len(admin.get(f"{API}/crm/pipelines/").json()) == 1  # not made twice


def test_lead_created_in_first_stage_with_history(admin):
    lead = _lead(admin)
    assert lead["code"].startswith("LD-")
    assert lead["stage"]["name"] == "Yangi"
    assert lead["status"] == "open"
    assert lead["phone"] == "+998 90 111 22 33"
    assert [m["body"] for m in _history(admin, "crm.lead", lead["id"])] == ["Lid yaratildi"]


def test_lead_matches_existing_client_by_phone(admin):
    c = admin.post(f"{API}/clients/", {"name": "Ali Valiyev", "phone": "90 111-22-33"}, format="json").json()
    lead = _lead(admin, title="")
    assert lead["client"]["id"] == c["id"]
    assert lead["title"] == "Ali Valiyev"


def test_board_groups_cards_by_stage(admin):
    _lead(admin)
    board = admin.get(f"{API}/crm/leads/board/").json()
    first = board["stages"][0]
    assert first["name"] == "Yangi" and len(first["leads"]) == 1
    assert all(not s["leads"] for s in board["stages"][1:])


def test_move_writes_one_history_line_and_lost_needs_reason(admin):
    lead = _lead(admin)
    st = _stages(admin)
    r = admin.post(f"{API}/crm/leads/{lead['id']}/move/", {"stage_id": st["O'lchov"]["id"]}, format="json")
    assert r.status_code == 200, r.content
    assert _history(admin, "crm.lead", lead["id"])[0]["changes"] == [
        {"field": "stage", "label": "Bosqich", "old": "Yangi", "new": "O'lchov"}]

    bad = admin.post(f"{API}/crm/leads/{lead['id']}/move/", {"stage_id": st["Rad etildi"]["id"]}, format="json")
    assert bad.status_code == 400 and bad.json()["error"]["field"] == "lost_reason"
    ok = admin.post(f"{API}/crm/leads/{lead['id']}/move/", {"stage_id": st["Rad etildi"]["id"], "lost_reason": "Qimmat"},
                    format="json").json()
    assert ok["status"] == "lost" and ok["lost_reason"] == "Qimmat"


def test_stage_with_leads_or_last_terminal_cannot_be_deleted(admin):
    lead = _lead(admin)
    st = _stages(admin)
    assert admin.delete(f"{API}/crm/stages/{lead['stage']['id']}/").status_code == 409
    assert admin.delete(f"{API}/crm/stages/{st['Yutildi']['id']}/").status_code == 409
    assert admin.delete(f"{API}/crm/stages/{st['Taklif']['id']}/").status_code == 204


def test_tasks_on_a_lead(admin):
    lead = _lead(admin)
    due = (timezone.now() - timedelta(hours=1)).isoformat()
    t = admin.post(f"{API}/crm/tasks/", {"lead_id": lead["id"], "kind": "measure", "text": "Obyektga borish",
                                         "due_at": due}, format="json")
    assert t.status_code == 201, t.content
    card = admin.get(f"{API}/crm/leads/{lead['id']}/").json()
    assert card["open_tasks"] == 1 and card["overdue"] is True and card["next_task_kind"] == "measure"

    done = admin.patch(f"{API}/crm/tasks/{t.json()['id']}/", {"done": True}, format="json").json()
    assert done["done"] and done["done_at"]
    assert _history(admin, "crm.lead", lead["id"])[0]["body"].startswith("Vazifa bajarildi: O'lchov")


def test_convert_creates_client_and_project_once(admin):
    lead = _lead(admin, contact_name="Aziz Karimov", budget="12000000", address="Samarqand, Registon 5")
    r = admin.post(f"{API}/crm/leads/{lead['id']}/convert/", {}, format="json")
    assert r.status_code == 200, r.content
    won = r.json()
    assert won["status"] == "won" and won["project"]["code"].startswith("LY-")
    assert won["client"]["name"] == "Aziz Karimov"

    project = admin.get(f"{API}/projects/{won['project']['id']}/").json()
    assert project["status"] == "draft" and project["amount"] == "12000000.00"
    assert project["client"]["id"] == won["client"]["id"]
    assert any(lead["code"] in m["body"] for m in _history(admin, "projects.project", project["id"]))

    assert admin.post(f"{API}/crm/leads/{lead['id']}/convert/", {}, format="json").status_code == 409
    assert admin.delete(f"{API}/crm/leads/{lead['id']}/").status_code == 409


def test_search_by_words(admin):
    _lead(admin, title="Kottej derazalari", contact_name="Botir")
    _lead(admin, title="Ofis eshiklari", phone="+998 93 000 00 01")
    items = admin.get(f"{API}/crm/leads/", {"q": "botir kottej"}).json()["items"]
    assert [i["title"] for i in items] == ["Kottej derazalari"]


# ---------------------------------------------------------------- telephony


def _hook(api, payload, token=None):
    return api.post(f"{API}/telephony/hook/{token or _token()}/", payload, format="json")


def _operator(admin):
    u = User.objects.create_user(username="op1", password="op1-pass-123", first_name="Operator")
    r = admin.post(f"{API}/telephony/extensions/", {"user_id": u.pk, "number": "101", "sip_password": "s3cret"},
                   format="json")
    assert r.status_code == 201, r.content
    assert "sip_password" not in r.json() and r.json()["has_password"] is True
    return u


def test_webhook_rejects_wrong_token(api):
    assert _hook(api, {"call_id": "x"}, token="wrong").status_code == 404


def test_missed_call_from_unknown_number_makes_lead_and_callback(api, admin):
    op = _operator(admin)
    assert _hook(api, {"call_id": "a1", "event": "ringing", "from": "+998901112233", "to": "101"}).status_code == 200
    call = Call.objects.get(external_id="a1")
    assert (call.direction, call.status, call.user_id) == ("in", "ringing", op.pk)

    _hook(api, {"call_id": "a1", "event": "hangup"})
    call.refresh_from_db()
    assert call.status == "missed" and call.lead_id and call.created_lead
    lead = admin.get(f"{API}/crm/leads/{call.lead_id}/").json()
    assert lead["phone"] == "+998 90 111 22 33" and lead["open_tasks"] == 1
    bodies = [m["body"] for m in _history(admin, "crm.lead", lead["id"])]
    assert "Kiruvchi qo'ng'iroq · +998 90 111 22 33 · o'tkazib yuborildi" in bodies

    # a late "ringing" changes nothing
    _hook(api, {"call_id": "a1", "event": "ringing", "from": "+998901112233", "to": "101"})
    call.refresh_from_db()
    assert call.status == "missed"

    # they get through: same lead, the call-back task is done
    _hook(api, {"call_id": "a2", "from": "901112233", "to": "101", "disposition": "ANSWERED", "billsec": 95})
    back = Call.objects.get(external_id="a2")
    assert back.lead_id == call.lead_id and back.status == "answered" and back.duration == 95
    lead = admin.get(f"{API}/crm/leads/{call.lead_id}/").json()
    assert lead["open_tasks"] == 0 and lead["calls_count"] == 2


def test_call_from_client_goes_to_client_history(api, admin):
    c = admin.post(f"{API}/clients/", {"name": "Mega Qurilish", "phone": "+998 71 200 30 40"}, format="json").json()
    TelephonySettings.objects.update_or_create(pk=1, defaults={"incoming_creates_lead": False})
    _hook(api, [{"call_id": "b1", "from": "712003040", "to": "102", "billsec": 31, "event": "hangup"}])
    call = Call.objects.get(external_id="b1")
    assert call.client_id == c["id"] and call.lead_id is None
    assert _history(admin, "clients.client", c["id"])[0]["body"] == "Kiruvchi qo'ng'iroq · +998 71 200 30 40 · 0:31"


def test_company_number_is_never_the_client(api, admin):
    TelephonySettings.objects.update_or_create(pk=1, defaults={"company_numbers": "+998 66 200 00 00"})
    _hook(api, {"call_id": "c1", "direction": "in", "from": "+998662000000", "to": "+998935554433", "billsec": 5})
    assert Call.objects.get(external_id="c1").client_phone == "+998935554433"


def test_softphone_reports_its_call_when_no_pbx_webhook(api, admin):
    op = _operator(admin)
    op.roles.add(Role.objects.get(name="Savdo menejeri"))
    me = login(api, "op1", "op1-pass-123")

    phone = me.get(f"{API}/telephony/me/").json()["phone"]
    assert phone["extension"] == "101" and phone["sip_password"] == ""  # browser phone off: no secret
    for ev in ({"event": "ringing", "direction": "out", "from": "101", "to": "901112233"}, {"event": "answer"},
               {"event": "hangup", "billsec": 40}):
        assert me.post(f"{API}/telephony/softphone/", {"call_id": "s1", **ev}, format="json").status_code == 200
    call = Call.objects.get(external_id=f"sp-{op.pk}-s1")
    assert (call.direction, call.status, call.duration, call.user_id) == ("out", "answered", 40, op.pk)
    assert me.get(f"{API}/telephony/calls/live/").json()[0]["id"] == call.pk

    # a live PBX webhook owns the records from now on
    _hook(api, {"call_id": "p1", "from": "+998901112299", "to": "101", "event": "ringing"})
    r = me.post(f"{API}/telephony/softphone/", {"call_id": "s2", "event": "ringing", "direction": "out", "to": "1"},
                format="json")
    assert r.json() == {"id": None}


def test_sip_password_goes_only_to_its_owner(api, admin):
    op = _operator(admin)
    admin.patch(f"{API}/telephony/settings/", {"sip_wss": "wss://pbx.rombo.uz:8089"}, format="json")
    ext = admin.get(f"{API}/telephony/extensions/").json()[0]
    admin.patch(f"{API}/telephony/extensions/{ext['id']}/", {"softphone": True, "sip_password": ""}, format="json")
    assert admin.get(f"{API}/telephony/me/").json()["phone"] is None  # admin has no extension
    op.is_superuser = True
    op.save()
    phone = login(api, "op1", "op1-pass-123").get(f"{API}/telephony/me/").json()["phone"]
    assert phone["sip_password"] == "s3cret"  # an empty field kept the saved password
    assert phone["wss"] == "wss://pbx.rombo.uz:8089/ws" and phone["sip_login"] == "101"


def test_settings_reject_bad_wss_and_rotate_token(api, admin):
    bad = admin.patch(f"{API}/telephony/settings/", {"sip_wss": "https://pbx"}, format="json")
    assert bad.status_code == 400 and bad.json()["error"]["field"] == "sip_wss"
    old = admin.get(f"{API}/telephony/settings/").json()["webhook_token"]
    new = admin.post(f"{API}/telephony/settings/rotate-token/").json()["webhook_token"]
    assert new != old
    assert _hook(api, {"call_id": "z"}, token=old).status_code == 404


def test_create_lead_from_call_and_stats(api, admin):
    TelephonySettings.objects.update_or_create(pk=1, defaults={"incoming_creates_lead": False})
    _hook(api, {"call_id": "d1", "from": "+998977776655", "to": "103", "billsec": 12, "event": "hangup"})
    call = admin.get(f"{API}/telephony/calls/").json()["items"][0]
    assert call["lead"] is None
    linked = admin.post(f"{API}/telephony/calls/{call['id']}/lead/").json()
    assert linked["lead"]["name"] == "Qo'ng'iroq: +998 97 777 66 55"
    assert admin.post(f"{API}/telephony/calls/{call['id']}/lead/").status_code == 409

    stats = admin.get(f"{API}/telephony/calls/stats/").json()
    assert stats["incoming"] == 1 and stats["answered"] == 1 and stats["talk_seconds"] == 12


def test_pages_are_guarded(api, admin):
    User.objects.create_user(username="nobody", password="nobody-123")
    other = login(api, "nobody", "nobody-123")
    assert other.get(f"{API}/crm/leads/").status_code == 403
    assert other.get(f"{API}/telephony/calls/").status_code == 403
    assert other.get(f"{API}/telephony/me/").status_code == 403
