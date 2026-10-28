from conftest import API, login


def test_any_user_reads_lists_only_page_writes(api, admin):
    admin.post(f"{API}/users/", {"username": "plain", "first_name": "P", "password": "password123"}, format="json")
    plain = login(api, "plain", "password123")
    r = plain.get(f"{API}/references/", {"kind": "product_type"})
    assert r.status_code == 200
    assert [i["name"] for i in r.json()["items"]] == ["Termo", "PVX", "Novation", "Kolenoe", "Aldoks"]
    assert plain.post(f"{API}/references/", {"kind": "brand", "name": "X"}, format="json").status_code == 403


def test_duplicate_name_and_used_item(admin):
    assert admin.post(f"{API}/references/", {"kind": "brand", "name": "Akfa"}, format="json").status_code == 409
    channel = admin.post(f"{API}/references/", {"kind": "sales_channel", "name": "Ko'rgazma"}, format="json").json()
    c = admin.post(f"{API}/clients/", {"name": "Test MChJ"}, format="json").json()
    admin.post(f"{API}/projects/", {"name": "Test", "client_id": c["id"], "sales_channel_id": channel["id"]}, format="json")
    assert admin.delete(f"{API}/references/{channel['id']}/").status_code == 409
