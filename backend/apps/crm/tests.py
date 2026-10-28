from datetime import timedelta

from django.utils import timezone

from apps.crm import phones
from conftest import API


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
    t = admin.post(f"{API}/crm/tasks/", {"lead_id": lead["id"], "kind": "O'lchov", "text": "Obyektga borish",
                                         "due_at": due}, format="json")
    assert t.status_code == 201, t.content
    card = admin.get(f"{API}/crm/leads/{lead['id']}/").json()
    assert card["open_tasks"] == 1 and card["overdue"] is True and card["next_task_kind"] == "O'lchov"

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
