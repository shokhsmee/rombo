from conftest import API, login


def test_login_wrong_password_has_generic_message(api):
    r = api.post(f"{API}/auth/login/", {"username": "admin", "password": "nope"}, format="json")
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "Login yoki parol noto'g'ri"


def test_superuser_sees_every_page(admin):
    me = admin.get(f"{API}/auth/me/").json()
    assert me["is_superuser"]
    assert set(me["permissions"]["clients"]) == {"view", "create", "update", "delete"}
    assert me["permissions"]["dashboard"] == ["view"]


def test_role_matrix_is_enforced(api, admin):
    role = admin.post(f"{API}/access/roles/", {
        "name": "Test sotuvchi",
        "permissions": [{"page_key": "clients", "can_create": True}],
    }, format="json").json()
    assert role["permissions"] == [{"page_key": "clients", "can_view": True, "can_create": True,
                                    "can_update": False, "can_delete": False}]

    r = admin.post(f"{API}/users/", {"username": "seller1", "first_name": "Seller", "password": "password123",
                                     "role_ids": [role["id"]]}, format="json")
    assert r.status_code == 201, r.content
    seller = login(api, "seller1", "password123")

    assert seller.get(f"{API}/auth/me/").json()["permissions"] == {"clients": ["create", "view"]}
    assert seller.get(f"{API}/clients/").status_code == 200
    created = seller.post(f"{API}/clients/", {"name": "Test MChJ", "kind": "company"}, format="json")
    assert created.status_code == 201
    assert created.json()["code"].startswith("MJ-")
    assert seller.delete(f"{API}/clients/{created.json()['id']}/").status_code == 403
    assert seller.get(f"{API}/employees/").status_code == 403
    assert seller.get(f"{API}/users/").status_code == 403


def test_system_role_cannot_be_deleted(admin):
    role = admin.get(f"{API}/access/roles/", {"q": "Administrator"}).json()["items"][0]
    r = admin.delete(f"{API}/access/roles/{role['id']}/")
    assert r.status_code == 409


def test_blocked_user_token_is_revoked(api, admin):
    u = admin.post(f"{API}/users/", {"username": "temp1", "first_name": "Temp", "password": "password123",
                                     "is_superuser": True}, format="json").json()
    temp = login(api, "temp1", "password123")
    assert temp.get(f"{API}/auth/me/").status_code == 200
    admin.patch(f"{API}/users/{u['id']}/", {"is_active": False}, format="json")
    assert temp.get(f"{API}/auth/me/").status_code == 401


def test_validation_error_shape(admin):
    r = admin.post(f"{API}/clients/", {"name": "X", "tin": "12"}, format="json")
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "validation_failed"
    assert set(err["fields"]) == {"name", "tin"}
