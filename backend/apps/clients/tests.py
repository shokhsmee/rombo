from apps.clients.models import FINISHED_PROJECT_STATUSES
from apps.projects.models import FINISHED_STATUSES
from conftest import API, login

SAMARQAND = {"latitude": "39.654200", "longitude": "66.959700"}


def _client(admin, name, **extra):
    r = admin.post(f"{API}/clients/", {"name": name, **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def test_point_is_saved_rounded_and_tracked(admin):
    c = _client(admin, "Ali Valiyev", latitude="39.65420049", longitude=66.9597)
    assert (c["latitude"], c["longitude"]) == ("39.654200", "66.959700")

    r = admin.patch(f"{API}/clients/{c['id']}/", {"latitude": "39.7", "longitude": "67.0"}, format="json")
    assert r.status_code == 200, r.content
    last = admin.get(f"{API}/chatter/", {"model": "clients.client", "res_id": c["id"]}).json()[0]
    assert {(ch["label"], ch["old"], ch["new"]) for ch in last["changes"]} == {
        ("Kenglik", "39.6542", "39.7"), ("Uzunlik", "66.9597", "67")}

    cleared = admin.patch(f"{API}/clients/{c['id']}/", {"latitude": None, "longitude": None}, format="json")
    assert (cleared.json()["latitude"], cleared.json()["longitude"]) == (None, None)


def test_point_needs_both_coordinates_in_range(admin):
    half = admin.post(f"{API}/clients/", {"name": "Yarim nuqta", "latitude": "39.65"}, format="json")
    assert half.status_code == 400
    assert half.json()["error"]["field"] == "longitude"

    far = admin.post(f"{API}/clients/", {"name": "Qutb", "latitude": "91", "longitude": "66"}, format="json")
    assert far.status_code == 400
    assert set(far.json()["error"]["fields"]) == {"latitude"}

    c = _client(admin, "Bor nuqta", **SAMARQAND)
    r = admin.patch(f"{API}/clients/{c['id']}/", {"longitude": None}, format="json")
    assert r.status_code == 400
    assert r.json()["error"]["field"] == "longitude"


def test_map_returns_only_points_with_list_filters(admin):
    dealer = _client(admin, "Oyna Diler", kind="dealer", phone="+998 66 111 22 33", **SAMARQAND)
    _client(admin, "Diler nuqtasiz", kind="dealer")
    _client(admin, "Jismoniy shaxs", latitude="39.66", longitude="66.97")
    for status, name in (("draft", "Ochiq loyiha"), ("cancelled", "Yopiq loyiha")):
        p = admin.post(f"{API}/projects/", {"name": name, "client_id": dealer["id"]}, format="json").json()
        if status == "cancelled":
            admin.post(f"{API}/projects/{p['id']}/status/", {"status": "cancelled", "comment": "Rad"},
                       format="json")

    everything = admin.get(f"{API}/clients/map/").json()
    assert (everything["total"], everything["without_point"]) == (2, 1)

    r = admin.get(f"{API}/clients/map/", {"kind": "dealer"}).json()
    assert (r["total"], r["without_point"]) == (1, 1)
    pin = r["items"][0]
    assert pin == {"id": dealer["id"], "code": dealer["code"], "name": "Oyna Diler", "kind": "dealer",
                   "phone": "+998 66 111 22 33", "region": "", "segment": None, "manager": None,
                   "lat": 39.6542, "lng": 66.9597, "active_projects": 1}

    assert admin.get(f"{API}/clients/map/", {"q": "jismoniy"}).json()["total"] == 1


def test_map_needs_map_page_and_clients_view(api, admin):
    def user_with(username, pages):
        role = admin.post(f"{API}/access/roles/", {
            "name": f"Rol {username}", "permissions": [{"page_key": p, "can_view": True} for p in pages],
        }, format="json").json()
        admin.post(f"{API}/users/", {"username": username, "first_name": "Test", "password": "password123",
                                     "role_ids": [role["id"]]}, format="json")
        return login(api, username, "password123")

    assert user_with("maponly", ["client_map"]).get(f"{API}/clients/map/").status_code == 403
    assert user_with("listonly", ["clients"]).get(f"{API}/clients/map/").status_code == 403
    assert user_with("both", ["clients", "client_map"]).get(f"{API}/clients/map/").status_code == 200


def test_seeded_sales_role_sees_the_map(admin):
    role = admin.get(f"{API}/access/roles/", {"q": "Savdo"}).json()["items"][0]
    perms = admin.get(f"{API}/access/roles/{role['id']}/").json()["permissions"]
    assert {"page_key": "client_map", "can_view": True, "can_create": False, "can_update": False,
            "can_delete": False} in perms


def test_finished_statuses_match_projects():
    assert set(FINISHED_PROJECT_STATUSES) == {s.value for s in FINISHED_STATUSES}


def test_migration_grants_map_to_roles_that_view_clients(admin):
    from importlib import import_module

    from django.apps import apps

    from apps.access.models import RolePermission

    migration = import_module("apps.clients.migrations.0005_client_coordinates")
    old = admin.post(f"{API}/access/roles/", {"name": "Eski rol", "permissions": [
        {"page_key": "clients", "can_view": True}]}, format="json").json()
    none = admin.post(f"{API}/access/roles/", {"name": "Mijozsiz rol", "permissions": [
        {"page_key": "projects", "can_view": True}]}, format="json").json()

    migration.grant_map_view(apps, None)
    granted = set(RolePermission.objects.filter(page_key="client_map", can_view=True)
                  .values_list("role_id", flat=True))
    assert old["id"] in granted and none["id"] not in granted
