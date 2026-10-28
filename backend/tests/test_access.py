from tests.conftest import API, login


def test_login_wrong_password(client):
    r = client.post(f"{API}/auth/login", data={"username": "admin", "password": "nope"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_superuser_sees_every_page(client, admin):
    me = client.get(f"{API}/auth/me", headers=admin).json()
    assert me["is_superuser"]
    assert set(me["permissions"]["clients"]) == {"view", "create", "update", "delete"}


def test_role_matrix_is_enforced(client, admin):
    # role: clients view+create only (write implies view is applied server-side)
    role = client.post(f"{API}/access/roles", headers=admin, json={
        "name": "Test sotuvchi",
        "permissions": [{"page_key": "clients", "can_create": True}],
    }).json()
    assert role["permissions"][0]["can_view"] is True

    client.post(f"{API}/users", headers=admin, json={
        "username": "seller1", "full_name": "Seller One", "password": "password123",
        "role_ids": [role["id"]],
    }).raise_for_status()
    seller = login(client, "seller1", "password123")

    me = client.get(f"{API}/auth/me", headers=seller).json()
    assert me["permissions"] == {"clients": ["create", "view"]}

    assert client.get(f"{API}/clients", headers=seller).status_code == 200
    created = client.post(f"{API}/clients", headers=seller, json={"name": "Test MChJ", "kind": "company"})
    assert created.status_code == 201
    assert client.delete(f"{API}/clients/{created.json()['id']}", headers=seller).status_code == 403
    assert client.get(f"{API}/employees", headers=seller).status_code == 403
    assert client.get(f"{API}/users", headers=seller).status_code == 403


def test_blocked_user_token_is_revoked(client, admin):
    u = client.post(f"{API}/users", headers=admin, json={
        "username": "temp1", "full_name": "Temp", "password": "password123", "is_superuser": True,
    }).json()
    token = login(client, "temp1", "password123")
    assert client.get(f"{API}/auth/me", headers=token).status_code == 200
    client.patch(f"{API}/users/{u['id']}", headers=admin, json={"is_active": False}).raise_for_status()
    assert client.get(f"{API}/auth/me", headers=token).status_code == 401
