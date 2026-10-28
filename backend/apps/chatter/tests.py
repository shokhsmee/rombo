from conftest import API, login


def _history(client, model, res_id):
    return client.get(f"{API}/chatter/", {"model": model, "res_id": res_id})


def test_tracked_change_lists_fields_as_people_read_them(admin):
    emp = admin.post(f"{API}/employees/", {"last_name": "Karimov", "first_name": "Ali"}, format="json").json()
    c = admin.post(f"{API}/clients/", {"name": "Test MChJ", "kind": "individual"}, format="json").json()
    admin.patch(f"{API}/clients/{c['id']}/", {"kind": "company", "manager_id": emp["id"], "notes": "x"}, format="json")

    msgs = _history(admin, "clients.client", c["id"]).json()
    assert msgs[-1]["body"] == "Mijoz yaratildi"
    track = msgs[0]
    assert track["kind"] == "track"
    assert track["author"] == "Tizim administratori"
    assert {(ch["label"], ch["old"], ch["new"]) for ch in track["changes"]} == {
        ("Turi", "Jismoniy shaxs", "Yuridik shaxs"),
        ("Menejer", "—", "Karimov Ali"),
    }  # notes is not tracked


def test_untracked_change_writes_nothing(admin):
    c = admin.post(f"{API}/clients/", {"name": "Test MChJ"}, format="json").json()
    admin.patch(f"{API}/clients/{c['id']}/", {"notes": "faqat izoh"}, format="json")
    assert len(_history(admin, "clients.client", c["id"]).json()) == 1


def test_note_and_empty_note(admin):
    c = admin.post(f"{API}/clients/", {"name": "Test MChJ"}, format="json").json()
    r = admin.post(f"{API}/chatter/", {"model": "clients.client", "res_id": c["id"], "body": "Qo'ng'iroq qilindi"},
                   format="json")
    assert r.status_code == 201 and r.json()["kind"] == "note"
    r = admin.post(f"{API}/chatter/", {"model": "clients.client", "res_id": c["id"], "body": "  "}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "body"


def test_needs_view_permission_and_known_model(api, admin):
    c = admin.post(f"{API}/clients/", {"name": "Test MChJ"}, format="json").json()
    admin.post(f"{API}/users/", {"username": "noone", "first_name": "No", "password": "password123"},
               format="json")
    noone = login(api, "noone", "password123")
    assert _history(noone, "clients.client", c["id"]).status_code == 403
    assert _history(admin, "auth.group", 1).status_code == 404
    assert _history(admin, "clients.client", 99999).status_code == 404


def test_role_matrix_change_is_logged(admin):
    role = admin.post(f"{API}/access/roles/", {"name": "Omborchi", "permissions": []}, format="json").json()
    admin.patch(f"{API}/access/roles/{role['id']}/",
                {"permissions": [{"page_key": "clients", "can_update": True}]}, format="json")
    msg = _history(admin, "access.role", role["id"]).json()[0]
    assert msg["changes"] == [{"field": "clients", "label": "Mijozlar", "old": "—", "new": "Ko'rish, Tahrirlash"}]
