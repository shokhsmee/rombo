from datetime import timedelta

import pytest
from django.utils import timezone

from apps.crm.models import ClientData, Lead, LeadTask
from apps.crm.services import worker
from apps.employees.models import Employee
from apps.users.models import User
from conftest import API


def _lead(admin, **body):
    r = admin.post(f"{API}/crm/leads/", {"title": "Uy derazalari", "phone": "+998 90 111 22 33", **body},
                   format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _pipeline(admin):
    return admin.get(f"{API}/crm/pipelines/").json()[0]


@pytest.fixture
def pushed(monkeypatch):
    """What the CRM pushed to browsers (apps.core.realtime.publish), in order."""
    out = []
    monkeypatch.setattr("apps.crm.services.live.publish", lambda msg, users=None: out.append((msg, users)))
    return out


# ---------------------------------------------------------------- custom fields, tags


def test_custom_fields_by_section(admin):
    rooms = admin.post(f"{API}/crm/fields/", {"label": "Xonalar soni", "type": "number", "section": "deal"},
                       format="json").json()
    birthday = admin.post(f"{API}/crm/fields/", {"label": "Tug'ilgan kun", "type": "date", "section": "contact"},
                          format="json").json()
    again = admin.post(f"{API}/crm/fields/", {"label": "Xonalar soni"}, format="json").json()
    assert (rooms["key"], birthday["key"], again["key"]) == ("xonalar_soni", "tug_ilgan_kun", "xonalar_soni_2")

    lead = _lead(admin)
    bad = admin.patch(f"{API}/crm/leads/{lead['id']}/", {"custom": {"tug_ilgan_kun": "1990-05-01"}}, format="json")
    assert bad.status_code == 400  # a contact value needs a client
    c = admin.post(f"{API}/clients/", {"name": "Ali Valiyev"}, format="json").json()
    r = admin.patch(f"{API}/crm/leads/{lead['id']}/", {"client_id": c["id"], "tags": ["VIP", " vip ", "VIP"],
                                                        "custom": {"xonalar_soni": 3, "tug_ilgan_kun": "1990-05-01",
                                                                   "unknown": "x"}}, format="json")
    assert r.status_code == 200, r.content
    out = r.json()
    assert out["values"] == {"xonalar_soni": 3, "tug_ilgan_kun": "1990-05-01"} and out["tags"] == ["VIP", "vip"]
    assert ClientData.objects.get(client_id=c["id"]).custom == {"tug_ilgan_kun": "1990-05-01"}
    # another lead of the same client shows the contact value
    other = _lead(admin, title="Balkon", client_id=c["id"], phone="")
    assert admin.get(f"{API}/crm/leads/{other['id']}/").json()["values"]["tug_ilgan_kun"] == "1990-05-01"
    # type and section never change
    admin.patch(f"{API}/crm/fields/{rooms['id']}/", {"type": "text", "section": "extra", "label": "Xonalar"},
                format="json")
    f = admin.get(f"{API}/crm/fields/").json()[0]
    assert (f["type"], f["section"], f["label"]) == ("number", "deal", "Xonalar")


def test_settings_task_types_and_card(admin):
    s = admin.get(f"{API}/crm/settings/").json()
    assert s["task_types"][2] == "O'lchov" and "task" in s["card_fields"]
    r = admin.patch(f"{API}/crm/settings/", {"task_types": ["Qo'ng'iroq", "Zamer", "Zamer", " "]}, format="json")
    assert r.json()["task_types"] == ["Qo'ng'iroq", "Zamer"]
    assert admin.patch(f"{API}/crm/settings/", {"task_types": []}, format="json").status_code == 400
    lead = _lead(admin)
    t = admin.post(f"{API}/crm/tasks/", {"lead_id": lead["id"], "text": "x"}, format="json").json()
    assert t["kind"] == "Qo'ng'iroq"  # the first type by default


def test_pipelines_lost_reasons_order_and_archive(admin):
    p = _pipeline(admin)
    assert [r["text"] for r in p["lost_reasons"]][:2] == ["Qimmat", "Boshqa joydan oldi"]
    r = admin.post(f"{API}/crm/pipelines/{p['id']}/lost-reasons/", {"text": "Muddati to'g'ri kelmadi"}, format="json")
    assert r.status_code == 201
    assert admin.delete(f"{API}/crm/lost-reasons/{r.json()['id']}/").status_code == 204
    work = [s["id"] for s in p["stages"] if not s["is_won"] and not s["is_lost"]]
    order = admin.post(f"{API}/crm/pipelines/{p['id']}/order/", {"ids": list(reversed(work))}, format="json").json()
    assert [s["id"] for s in order["stages"]][:len(work)] == list(reversed(work))
    assert admin.patch(f"{API}/crm/pipelines/{p['id']}/", {"is_active": False}, format="json").status_code == 409
    second = admin.post(f"{API}/crm/pipelines/", {"name": "Dilerlar"}, format="json").json()
    assert admin.patch(f"{API}/crm/pipelines/{p['id']}/", {"is_active": False}, format="json").status_code == 200
    assert admin.get(f"{API}/crm/pipelines/").json()[1]["id"] == second["id"]
    assert [x for x in admin.get(f"{API}/crm/pipelines/").json() if x["is_default"]][0]["id"] == second["id"]


# ---------------------------------------------------------------- duplicates and merging


def test_duplicates_and_merge(admin):
    a = _lead(admin, title="Kottej", budget="10000000", tags=["sayt"], notes="Birinchi")
    b = _lead(admin, title="Kottej (qayta)", phone="90-111-22-33", budget="15000000", tags=["VIP"], notes="Ikkinchi")
    admin.post(f"{API}/crm/tasks/", {"lead_id": b["id"], "kind": "Uchrashuv"}, format="json")
    card = admin.get(f"{API}/crm/leads/{a['id']}/").json()
    assert [d["id"] for d in card["duplicates"]] == [b["id"]]
    assert {x["id"]: x["dup"] for x in admin.get(f"{API}/crm/leads/").json()["items"]} == {a["id"]: True, b["id"]: True}
    assert [d["id"] for d in admin.get(f"{API}/crm/leads/duplicates/", {"phone": "901112233"}).json()] == [b["id"], a["id"]]

    r = admin.post(f"{API}/crm/leads/{b['id']}/merge/", {"into_id": a["id"]}, format="json")
    assert r.status_code == 200, r.content
    into = r.json()
    assert into["budget"] == "15000000.00" and into["tags"] == ["sayt", "VIP"] and into["open_tasks"] == 1
    assert into["duplicates"] == []
    gone = Lead.objects.get(pk=b["id"])
    assert gone.status == "lost" and gone.lost_reason == f"Dubl: {a['code']}"
    assert Lead.objects.get(pk=a["id"]).notes == "Birinchi\n\nIkkinchi"
    assert admin.post(f"{API}/crm/leads/{a['id']}/merge/", {"into_id": b["id"]}, format="json").status_code == 409


# ---------------------------------------------------------------- distribution


def test_auto_assignment_round_robin_and_least_open(admin, pushed):
    users = [User.objects.create_user(username=f"m{i}", password="m-pass-123") for i in range(3)]
    emps = [Employee.objects.create(last_name=f"M{i}", first_name="X", user=u) for i, u in enumerate(users)]
    ids = [e.pk for e in emps]
    admin.patch(f"{API}/crm/settings/", {"distribution_enabled": True, "distribution_managers": ids}, format="json")
    picks = [_lead(admin, title=f"L{i}", phone=f"+99890000000{i}", auto_manager=True)["manager"]["id"] for i in range(4)]
    assert picks == [ids[0], ids[1], ids[2], ids[0]]
    assert any(m["type"] == "notify" and to == [users[1].pk] for m, to in pushed)  # "Sizga yangi lid"
    # a manager given by hand is kept; auto off → nobody
    assert _lead(admin, title="Q", phone="", manager_id=ids[2])["manager"]["id"] == ids[2]
    admin.patch(f"{API}/crm/settings/", {"distribution_mode": "least_open"}, format="json")
    assert _lead(admin, title="R", phone="", auto_manager=True)["manager"]["id"] == ids[1]  # 1 open lead vs 2
    admin.patch(f"{API}/crm/settings/", {"distribution_enabled": False}, format="json")
    assert _lead(admin, title="S", phone="", auto_manager=True)["manager"] is None


# ---------------------------------------------------------------- bulk


def test_bulk_actions(admin):
    p = _pipeline(admin)
    st = {s["name"]: s for s in p["stages"]}
    leads = [_lead(admin, title=f"B{i}", phone=f"+99891000000{i}") for i in range(3)]
    ids = [x["id"] for x in leads]
    emp = Employee.objects.create(last_name="Bulk", first_name="M")
    assert admin.post(f"{API}/crm/leads/bulk/", {"ids": ids, "action": "move", "stage_id": st["Taklif"]["id"]},
                      format="json").json() == {"updated": 3}
    admin.post(f"{API}/crm/leads/bulk/", {"ids": ids, "action": "assign", "manager_id": emp.pk}, format="json")
    admin.post(f"{API}/crm/leads/bulk/", {"ids": ids[:2], "action": "tag", "tag": "aksiya"}, format="json")
    admin.post(f"{API}/crm/leads/bulk/", {"ids": ids[:1], "action": "untag", "tag": "aksiya"}, format="json")
    got = {x.pk: x for x in Lead.objects.filter(pk__in=ids)}
    assert {x.stage.name for x in got.values()} == {"Taklif"} and {x.manager_id for x in got.values()} == {emp.pk}
    assert (got[ids[0]].tags, got[ids[1]].tags) == ([], ["aksiya"])
    assert admin.post(f"{API}/crm/leads/bulk/", {"ids": ids, "action": "lost"}, format="json").status_code == 400
    admin.post(f"{API}/crm/leads/bulk/", {"ids": ids[:1], "action": "lost", "reason": "Qimmat"}, format="json")
    assert Lead.objects.get(pk=ids[0]).status == "lost"
    admin.post(f"{API}/crm/leads/bulk/", {"ids": ids[1:], "action": "delete"}, format="json")
    assert Lead.objects.filter(pk__in=ids).count() == 1


# ---------------------------------------------------------------- analytics, board filters


def test_analytics_funnel_and_managers(admin):
    p = _pipeline(admin)
    st = {s["name"]: s for s in p["stages"]}
    emp = Employee.objects.create(last_name="Karimov", first_name="J")
    a = _lead(admin, title="A", manager_id=emp.pk, budget="1000")
    b = _lead(admin, title="B", phone="+998902222222", manager_id=emp.pk, source_id=None)
    admin.post(f"{API}/crm/leads/{a['id']}/move/", {"stage_id": st["O'lchov"]["id"]}, format="json")
    admin.post(f"{API}/crm/leads/{a['id']}/move/", {"stage_id": st["Yutildi"]["id"]}, format="json")
    admin.post(f"{API}/crm/leads/{b['id']}/move/", {"stage_id": st["Rad etildi"]["id"], "lost_reason": "Qimmat"},
               format="json")
    r = admin.get(f"{API}/crm/analytics/").json()
    t = r["totals"]
    assert (t["new"], t["won"], t["lost"], t["win_rate"], t["won_budget"]) == (2, 1, 1, 50, "1000.00")
    funnel = {f["name"]: f["leads"] for f in r["funnel"]}
    assert funnel["Yangi"] == 2 and funnel["O'lchov"] == 1 and funnel["Yutildi"] == 1
    assert r["lost_reasons"] == [{"reason": "Qimmat", "leads": 1}]
    m = r["managers"][0]
    assert (m["name"], m["new"], m["won"], m["lost"]) == ("Karimov J", 2, 1, 1)
    assert sum(x["new"] for x in r["series"]) == 2


def test_board_closed_filter(admin):
    p = _pipeline(admin)
    lost = {s["name"]: s for s in p["stages"]}["Rad etildi"]
    a = _lead(admin)
    admin.post(f"{API}/crm/leads/{a['id']}/move/", {"stage_id": lost["id"], "lost_reason": "x"}, format="json")
    Lead.objects.filter(pk=a["id"]).update(updated_at=timezone.now() - timedelta(days=40))
    count = lambda q: sum(len(s["leads"]) for s in admin.get(f"{API}/crm/leads/board/", q).json()["stages"])  # noqa: E731
    assert count({}) == 0 and count({"closed": "all"}) == 1


# ---------------------------------------------------------------- worker


def test_worker_reminds_due_tasks_once(admin, pushed):
    lead = _lead(admin)
    admin.post(f"{API}/crm/tasks/", {"lead_id": lead["id"], "kind": "O'lchov", "text": "Obyekt",
                                     "due_at": (timezone.now() + timedelta(minutes=3)).isoformat()}, format="json")
    LeadTask.objects.create(lead_id=lead["id"], kind="Uchrashuv", due_at=timezone.now() + timedelta(hours=5))
    pushed.clear()
    assert worker.run_once()["reminders"] == 1
    note = [m for m, _ in pushed if m["type"] == "notify"][0]
    assert note["title"].startswith("Vazifa") and note["link"] == f"/crm/leads/{lead['id']}"
    assert worker.run_once()["reminders"] == 0
