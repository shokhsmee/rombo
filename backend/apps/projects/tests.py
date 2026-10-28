from conftest import API


def _project(admin, name="Uy derazalari"):
    c = admin.post(f"{API}/clients/", {"name": "Ali Valiyev", "phone": "+998901112233"}, format="json").json()
    r = admin.post(f"{API}/projects/", {"name": name, "client_id": c["id"], "amount": "1500000"}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _history(admin, pid):
    return admin.get(f"{API}/chatter/", {"model": "projects.project", "res_id": pid}).json()


def test_project_created_as_draft_with_history(admin):
    p = _project(admin)
    assert p["status"] == "draft"
    assert p["code"].startswith("LY-")
    assert p["client"]["name"] == "Ali Valiyev"
    assert [m["body"] for m in _history(admin, p["id"])] == ["Loyiha yaratildi"]
    assert set(p["allowed_statuses"]) == {"confirmed", "cancelled"}


def test_status_workflow_and_header_lock(admin):
    pid = _project(admin)["id"]
    bad = admin.post(f"{API}/projects/{pid}/status/", {"status": "ready"}, format="json")
    assert bad.status_code == 400
    assert bad.json()["error"]["field"] == "status"

    for s in ("confirmed", "production"):
        r = admin.post(f"{API}/projects/{pid}/status/", {"status": s}, format="json")
        assert r.status_code == 200, r.content
    assert _history(admin, pid)[0]["changes"] == [
        {"field": "status", "label": "Holat", "old": "Tasdiqlangan", "new": "Ishlab chiqarishda"}]
    assert r.json()["allowed_statuses"] == ["ready"]

    locked = admin.patch(f"{API}/projects/{pid}/", {"name": "Boshqa nom"}, format="json")
    assert locked.status_code == 409


def test_cancel_requires_reason_and_logs_it_once(admin):
    pid = _project(admin)["id"]
    r = admin.post(f"{API}/projects/{pid}/status/", {"status": "cancelled"}, format="json")
    assert r.json()["error"]["field"] == "comment"

    admin.post(f"{API}/projects/{pid}/status/", {"status": "cancelled", "comment": "Mijoz rad etdi"}, format="json")
    last, *rest = _history(admin, pid)
    assert last["body"] == "Mijoz rad etdi"
    assert last["changes"][0]["new"] == "Bekor qilindi"
    assert len(rest) == 1  # only "Loyiha yaratildi" before it — no duplicate line


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


# ---------------------------------------------------------------- order card (add-loyiha-card-fields)

def _ref(admin, kind, name):
    items = admin.get(f"{API}/references/", {"kind": kind, "size": 100}).json()["items"]
    return next(i["id"] for i in items if i["name"] == name)


def _card(admin):
    c = admin.post(f"{API}/clients/", {"name": "Ali Valiyev", "phone": "+998901112233"}, format="json").json()
    r = admin.post(f"{API}/projects/", {
        "name": "Uy derazalari", "client_id": c["id"], "amount": "10000000", "service_amount": "1500000",
        "advance_amount": "4000000", "sale_date": "2026-10-20", "mosquito_net": True,
        "sales_channel_id": _ref(admin, "sales_channel", "Tavsiya"), "brand_id": _ref(admin, "brand", "Akfa"),
        "items": [
            {"product_type_id": _ref(admin, "product_type", "Termo"), "area_m2": "12.5", "quantity": 4},
            {"product_type_id": _ref(admin, "product_type", "PVX"), "area_m2": "8", "quantity": 3},
        ],
    }, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def test_card_money_and_lines_totals(admin):
    p = _card(admin)
    assert p["debt_amount"] == "7500000.00"
    assert p["total_amount"] == "11500000.00"
    assert p["total_area"] == "20.50" and p["total_quantity"] == 7
    assert [i["product_type"]["name"] for i in p["items"]] == ["Termo", "PVX"]
    assert p["sales_channel"]["name"] == "Tavsiya" and p["mosquito_net"] is True
    listed = admin.get(f"{API}/projects/", {"q": p["code"]}).json()["items"][0]
    assert listed["debt_amount"] == "7500000.00" and listed["total_area"] == "20.50"


def test_line_change_is_logged(admin):
    p = _card(admin)
    termo = _ref(admin, "product_type", "Termo")
    admin.patch(f"{API}/projects/{p['id']}/", {"items": [{"product_type_id": termo, "area_m2": "15", "quantity": 5}]},
                format="json")
    msg = admin.get(f"{API}/chatter/", {"model": "projects.project", "res_id": p["id"]}).json()[0]
    assert msg["changes"][0]["label"] == "Buyumlar"
    assert msg["changes"][0]["new"] == "Termo 15 m² × 5"


def test_lock_keeps_money_editable_in_production(admin):
    p = _card(admin)
    for s in ("confirmed", "production"):
        admin.post(f"{API}/projects/{p['id']}/status/", {"status": s}, format="json")
    r = admin.patch(f"{API}/projects/{p['id']}/", {"advance_amount": "9000000", "name": p["name"]}, format="json")
    assert r.status_code == 200, r.content  # unchanged name is fine
    assert r.json()["debt_amount"] == "2500000.00"
    r = admin.patch(f"{API}/projects/{p['id']}/", {"items": []}, format="json")
    assert r.status_code == 409 and "Buyumlar" in r.json()["error"]["message"]


def test_drawings_upload_download_delete(admin, settings, tmp_path):
    from django.core.files.uploadedfile import SimpleUploadedFile

    settings.MEDIA_ROOT = tmp_path
    p = _card(admin)
    bad = admin.post(f"{API}/projects/{p['id']}/files/", {"file": SimpleUploadedFile("x.exe", b"MZ")}, format="multipart")
    assert bad.status_code == 400 and bad.json()["error"]["field"] == "file"

    up = admin.post(f"{API}/projects/{p['id']}/files/", {"file": SimpleUploadedFile("chizma.pdf", b"%PDF-1.4 test")},
                    format="multipart")
    assert up.status_code == 201, up.content
    fid = up.json()["id"]
    got = admin.get(f"{API}/projects/{p['id']}/files/{fid}/")
    assert got.status_code == 200 and b"".join(got.streaming_content) == b"%PDF-1.4 test"
    assert admin.get(f"{API}/projects/{p['id']}/").json()["files"][0]["name"] == "chizma.pdf"
    assert admin.delete(f"{API}/projects/{p['id']}/files/{fid}/").status_code == 204
    bodies = [m["body"] for m in admin.get(f"{API}/chatter/", {"model": "projects.project", "res_id": p["id"]}).json()]
    assert "Chizma yuklandi: chizma.pdf" in bodies and "Chizma o'chirildi: chizma.pdf" in bodies
