from conftest import API


def _project(admin, name="Uy derazalari"):
    c = admin.post(f"{API}/clients/", {"name": "Ali Valiyev", "phone": "+998901112233"}, format="json").json()
    r = admin.post(f"{API}/projects/", {"name": name, "client_id": c["id"], "amount": "1500000"}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def test_project_created_as_draft_with_history(admin):
    p = _project(admin)
    assert p["status"] == "draft"
    assert p["code"].startswith("LY-")
    assert p["client"]["name"] == "Ali Valiyev"
    assert len(p["history"]) == 1
    assert set(p["allowed_statuses"]) == {"confirmed", "cancelled"}


def test_status_workflow_and_header_lock(admin):
    pid = _project(admin)["id"]
    bad = admin.post(f"{API}/projects/{pid}/status/", {"status": "ready"}, format="json")
    assert bad.status_code == 400
    assert bad.json()["error"]["field"] == "status"

    for s in ("confirmed", "production"):
        r = admin.post(f"{API}/projects/{pid}/status/", {"status": s}, format="json")
        assert r.status_code == 200, r.content
    assert r.json()["history"][0]["to_status"] == "production"
    assert r.json()["allowed_statuses"] == ["ready"]

    locked = admin.patch(f"{API}/projects/{pid}/", {"name": "Boshqa nom"}, format="json")
    assert locked.status_code == 409


def test_cancel_requires_reason(admin):
    pid = _project(admin)["id"]
    r = admin.post(f"{API}/projects/{pid}/status/", {"status": "cancelled"}, format="json")
    assert r.json()["error"]["field"] == "comment"


def test_search_matches_every_word_across_client(admin):
    _project(admin, name="Qidiruv sinovi")
    _project(admin, name="Boshqa loyiha")
    r = admin.get(f"{API}/projects/", {"q": "valiyev qidiruv"}).json()
    assert [i["name"] for i in r["items"]] == ["Qidiruv sinovi"]


def test_client_with_projects_cannot_be_deleted(admin):
    p = _project(admin)
    assert admin.delete(f"{API}/clients/{p['client']['id']}/").status_code == 409


def test_only_draft_can_be_deleted(admin):
    pid = _project(admin)["id"]
    admin.post(f"{API}/projects/{pid}/status/", {"status": "confirmed"}, format="json")
    assert admin.delete(f"{API}/projects/{pid}/").status_code == 409
