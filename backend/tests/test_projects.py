from tests.conftest import API


def _make_project(client, admin, name="Uy derazalari"):
    c = client.post(f"{API}/clients", headers=admin, json={"name": "Ali Valiyev", "phone": "+998901112233"})
    p = client.post(f"{API}/projects", headers=admin,
                    json={"name": name, "client_id": c.json()["id"], "amount": "1500000"})
    assert p.status_code == 201, p.text
    return p.json()


def test_project_created_as_draft_with_history(client, admin):
    p = _make_project(client, admin)
    assert p["status"] == "draft"
    assert p["code"].startswith("LY-")
    assert p["client"]["name"] == "Ali Valiyev"
    assert len(p["history"]) == 1
    assert set(p["allowed_statuses"]) == {"confirmed", "cancelled"}


def test_status_workflow_and_lock(client, admin):
    p = _make_project(client, admin)
    pid = p["id"]

    bad = client.post(f"{API}/projects/{pid}/status", headers=admin, json={"status": "ready"})
    assert bad.status_code == 422

    for s in ("confirmed", "production"):
        r = client.post(f"{API}/projects/{pid}/status", headers=admin, json={"status": s})
        assert r.status_code == 200, r.text
    assert r.json()["history"][0]["to_status"] == "production"

    locked = client.patch(f"{API}/projects/{pid}", headers=admin, json={"name": "Boshqa nom"})
    assert locked.status_code == 409


def test_cancel_requires_reason(client, admin):
    pid = _make_project(client, admin)["id"]
    r = client.post(f"{API}/projects/{pid}/status", headers=admin, json={"status": "cancelled"})
    assert r.status_code == 422
    assert r.json()["error"]["field"] == "comment"


def test_search_by_client_name(client, admin):
    _make_project(client, admin, name="Qidiruv sinovi")
    r = client.get(f"{API}/projects", headers=admin, params={"q": "valiyev qidiruv"}).json()
    assert r["total"] >= 1
    assert all("Qidiruv" in i["name"] for i in r["items"])


def test_client_with_projects_cannot_be_deleted(client, admin):
    p = _make_project(client, admin)
    r = client.delete(f"{API}/clients/{p['client_id']}", headers=admin)
    assert r.status_code == 409
