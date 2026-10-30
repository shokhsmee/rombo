"""add-bom, add-project-materials, add-mrp: the scenarios of their specs at API level."""

import io
from decimal import Decimal

import pytest
from openpyxl import Workbook

from apps.accounting.seed import seed_chart
from apps.inventory.models import StockMove
from apps.mrp.models import Bom, ProjectMaterial
from apps.procurement.models import PurchaseRequest
from apps.references.models import RefItem
from conftest import API

M = f"{API}/mrp"
INV = f"{API}/inventory"
D = Decimal


@pytest.fixture(autouse=True)
def _chart(db):
    seed_chart()


# ------------------------------------------------------------------ helpers


def _product(admin, name, unit="dona", category="material", **extra):
    r = admin.post(f"{INV}/products/", {"name": name, "unit": unit, "category": category, **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _bom(admin, product, lines, expect=201):
    r = admin.post(f"{M}/boms/", {"product_id": product["id"], "lines": [
        {"component_id": c["id"], "qty": str(q), "basis": b, "waste_pct": str(w)} for c, q, b, w in lines]},
        format="json")
    assert r.status_code == expect, r.content
    return r.json()


def _window(admin):
    """Window: profile 3.2 m per m² + 5 % waste, 1 handle per piece."""
    profil = _product(admin, "Profil 60", "m", "profil", order_multiple="6.5")
    ruchka = _product(admin, "Ruchka", "dona", "furnitura")
    window = _product(admin, "Termo deraza", "dona", "tayyor")
    bom = _bom(admin, window, [(profil, "3.2", "m2", "5"), (ruchka, "1", "dona", "0")])
    return window, profil, ruchka, bom


def _type_id(name="Termo"):
    return RefItem.objects.get(kind="product_type", name=name).pk


def _project(admin, area="10", qty=4, deadline=None, status="draft"):
    c = admin.post(f"{API}/clients/", {"name": "Ali Valiyev"}, format="json").json()
    body = {"name": "Uy", "client_id": c["id"], "items": [{"product_type_id": _type_id(), "area_m2": area,
                                                           "quantity": qty}]}
    if deadline:
        body["deadline"] = deadline
    p = admin.post(f"{API}/projects/", body, format="json")
    assert p.status_code == 201, p.content
    p = p.json()
    if status != "draft":
        _status(admin, p, status)
    return p


def _status(admin, p, status):
    r = admin.post(f"{API}/projects/{p['id']}/status/", {"status": status}, format="json")
    assert r.status_code == 200, r.content


def _spec(admin, p, product, position=0):
    r = admin.post(f"{M}/projects/{p['id']}/item-product/", {"position": position, "product_id": product["id"]},
                   format="json")
    assert r.status_code == 200, r.content
    return r.json()


def _materials(admin, p):
    return {r["product"]["name"]: r for r in admin.get(f"{M}/projects/{p['id']}/materials/").json()["rows"]}


def _stock_in(admin, product, qty, cost="1000"):
    m = admin.post(f"{INV}/moves/", {"type": "adjust", "product_id": product["id"], "qty": str(qty),
                                     "unit_cost": cost}, format="json").json()
    assert admin.post(f"{INV}/moves/{m['id']}/post/").status_code == 200


# ------------------------------------------------------------------ add-bom


def test_explosion_window(admin):
    window, *_ , bom = _window(admin)
    out = {r["product"]["name"]: D(r["qty"]) for r in
           admin.get(f"{M}/boms/{bom['id']}/explode/", {"count": "4", "area": "10"}).json()}
    assert out == {"Profil 60": D("33.6"), "Ruchka": D("4")}  # 3.2 × 10 m² × 1.05; 1 × 4


def test_semi_finished_component_explodes(admin):
    glass = _product(admin, "Oyna 4 mm", "m2", "oyna")
    unit = _product(admin, "Steklopaket", "m2", "yarim")
    _bom(admin, unit, [(glass, "2", "dona", "0")])
    window = _product(admin, "Deraza", "dona", "tayyor")
    bom = _bom(admin, window, [(unit, "0.9", "m2", "0")])
    out = {r["product"]["name"]: D(r["qty"]) for r in
           admin.get(f"{M}/boms/{bom['id']}/explode/", {"count": "1", "area": "1"}).json()}
    assert out == {"Oyna 4 mm": D("1.8")}


def test_cycle_refused(admin):
    unit = _product(admin, "Steklopaket", "m2", "yarim")
    window = _product(admin, "Deraza", "dona", "yarim")
    _bom(admin, unit, [(window, "1", "dona", "0")])
    r = _bom(admin, window, [(unit, "1", "dona", "0")], expect=400)
    assert "o'zini o'z ichiga" in r["error"]["message"]


def test_bom_only_for_made_products(admin):
    profil = _product(admin, "Profil", "m", "profil")
    other = _product(admin, "Ruchka")
    assert _bom(admin, profil, [(other, "1", "dona", "0")], expect=400)["error"]["field"] == "product"


def test_one_active_bom_and_cost(admin):
    window, profil, ruchka, bom = _window(admin)
    _stock_in(admin, profil, 100, "45000")
    _stock_in(admin, ruchka, 10, "30000")
    second = _bom(admin, window, [(profil, "3", "m2", "0")])
    assert second["version"] == 2 and not Bom.objects.get(pk=bom["id"]).is_active
    cost = admin.get(f"{M}/boms/{bom['id']}/").json()["cost"]
    assert D(cost["per_m2"]) == D("151200") and D(cost["per_piece"]) == D("30000")  # 3.2×1.05×45 000


def test_bom_lines_excel_import(admin):
    window, profil, ruchka, bom = _window(admin)
    glass = _product(admin, "Oyna", "m2", "oyna")
    wb = Workbook()
    for row in (["Tarkib", "Material", "Miqdor", "Asos"], [window["code"], glass["code"], 0.85, "m2"],
                [bom["code"], "Yo'q material", 1, "dona"]):
        wb.active.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    buf.name = "t.xlsx"
    out = admin.post(f"{M}/bom-lines/import/", {"file": buf}, format="multipart").json()
    assert [r["ok"] for r in out["rows"]] == [True, False]
    assert {ln["component"]["name"] for ln in admin.get(f"{M}/boms/{bom['id']}/").json()["lines"]} == {
        "Profil 60", "Ruchka", "Oyna"}


# ------------------------------------------------------------------ add-project-materials


def test_materials_follow_items_while_draft(admin):
    window, *_ = _window(admin)
    p = _project(admin)
    _spec(admin, p, window)
    assert D(_materials(admin, p)["Ruchka"]["need"]) == D("4")
    r = admin.patch(f"{API}/projects/{p['id']}/", {"items": [
        {"product_type_id": _type_id(), "area_m2": "15", "quantity": 6}]}, format="json")
    assert r.status_code == 200, r.content
    mats = _materials(admin, p)
    assert (D(mats["Ruchka"]["need"]), D(mats["Profil 60"]["need"])) == (D("6"), D("50.4"))


def test_freeze_on_confirm_and_new_version(admin):
    window, profil, ruchka, bom = _window(admin)
    p = _project(admin)
    _spec(admin, p, window)
    _status(admin, p, "confirmed")
    assert ProjectMaterial.objects.filter(project_id=p["id"]).count() == 2
    r = admin.patch(f"{M}/boms/{bom['id']}/", {"lines": [
        {"component_id": ruchka["id"], "qty": "2", "basis": "dona", "waste_pct": "0"}]}, format="json")
    assert r.status_code == 200 and r.json()["id"] != bom["id"] and r.json()["version"] == 2
    assert Bom.objects.get(pk=bom["id"]).lines.count() == 2  # the old version untouched
    assert D(_materials(admin, p)["Ruchka"]["need"]) == D("4")  # the confirmed Loyiha keeps its list


def test_documents_from_materials(admin):
    window, profil, ruchka, _ = _window(admin)
    p = _project(admin, status="confirmed")
    _spec_after = admin.post(f"{M}/projects/{p['id']}/item-product/", {"position": 0, "product_id": window["id"]},
                             format="json")
    assert _spec_after.status_code == 200  # not frozen: nothing was specified when it was confirmed
    admin.post(f"{M}/projects/{p['id']}/freeze/")
    out = admin.post(f"{M}/projects/{p['id']}/to-issue/", {}, format="json")
    assert out.status_code == 200, out.content
    moves = StockMove.objects.filter(project_id=p["id"], type="issue", status="draft")
    assert {(m.product.name, m.qty) for m in moves} == {("Profil 60", D("33.600")), ("Ruchka", D("4.000"))}
    r = admin.post(f"{M}/projects/{p['id']}/to-request/", {}, format="json")
    assert r.status_code == 200, r.content
    req = PurchaseRequest.objects.get(pk=r.json()["request"]["id"])
    assert {(ln.product.name, ln.qty) for ln in req.lines.all()} == {("Profil 60", D("33.60")), ("Ruchka", D("4.00"))}
    again = admin.post(f"{M}/projects/{p['id']}/to-request/", {}, format="json")
    assert again.status_code == 409  # all requested already


def test_no_refreeze_after_issue(admin):
    window, profil, ruchka, _ = _window(admin)
    _stock_in(admin, ruchka, 10)
    p = _project(admin)
    _spec(admin, p, window)
    _status(admin, p, "confirmed")
    m = admin.post(f"{INV}/moves/", {"type": "issue", "product_id": ruchka["id"], "qty": "1",
                                     "project_id": p["id"]}, format="json").json()
    admin.post(f"{INV}/moves/{m['id']}/post/")
    assert admin.post(f"{M}/projects/{p['id']}/freeze/").status_code == 409
    assert D(_materials(admin, p)["Ruchka"]["remaining"]) == D("3")


def test_fill_calc_from_bom(admin):
    p = _project(admin)
    pl = next(x for x in admin.get(f"{API}/pricing/").json()["items"] if x["name"].startswith("Rombo Termo"))
    items = admin.get(f"{API}/pricing/{pl['id']}/").json()["items"]
    lka = _product(admin, "L -ka", "шт", "profil", price_item_id=items[0]["id"])
    window = _product(admin, "Termo deraza", "dona", "tayyor")
    _bom(admin, window, [(lka, "1.5", "dona", "0")])
    _spec(admin, p, window)
    calc = admin.post(f"{API}/projects/{p['id']}/calcs/", {"price_list_id": pl["id"]}, format="json").json()
    r = admin.post(f"{M}/projects/{p['id']}/fill-calc/", {"calc_id": calc["id"]}, format="json")
    assert r.status_code == 200 and r.json()["fill"]["filled"] == 1, r.content
    lines = admin.get(f"{API}/projects/{p['id']}/calcs/{calc['id']}/").json()["lines"]
    assert next(ln for ln in lines if ln["name"] == "L -ka")["qty"] == "6.00"


# ------------------------------------------------------------------ add-mrp


def _need_profile(admin, profil, area, deadline):
    window = Bom.objects.filter(product__name="Termo deraza").first()
    if window is None:
        w = _product(admin, "Termo deraza", "dona", "tayyor")
        _bom(admin, w, [(profil, "1", "m2", "0")])
        window = Bom.objects.get(product_id=w["id"])
    p = _project(admin, area=area, qty=1, deadline=deadline)
    _spec(admin, p, {"id": window.product_id})
    _status(admin, p, "confirmed")
    return p


def test_net_requirements(admin):
    profil = _product(admin, "Profil 60", "m", "profil", order_multiple="6.5")
    _need_profile(admin, profil, "40", "2026-11-05")
    _need_profile(admin, profil, "30", "2026-11-20")
    _stock_in(admin, profil, 20)
    from apps.procurement.models import OrderStatus, PurchaseOrder, PurchaseOrderLine
    from apps.clients.models import Client, ClientKind

    sup = Client.objects.create(name="AKFA", kind=ClientKind.SUPPLIER)
    order = PurchaseOrder.objects.create(supplier=sup, date="2026-10-30", status=OrderStatus.SENT)
    PurchaseOrderLine.objects.create(order=order, product_id=profil["id"], name="Profil 60", unit="m", qty=26)
    row = next(r for r in admin.get(f"{M}/plan/").json()["rows"] if r["product"]["id"] == profil["id"])
    assert (D(row["need"]), D(row["stock"]), D(row["on_order"]), D(row["shortage"]), D(row["to_buy"])) == (
        D("70"), D("20"), D("26"), D("24"), D("26"))
    assert [a["project"]["deadline"] for a in row["projects"]] == ["2026-11-05", "2026-11-20"]
    assert (D(row["projects"][0]["short"]), D(row["projects"][1]["short"])) == (D("0"), D("24"))


def test_requests_earliest_deadline_first(admin):
    profil = _product(admin, "Profil 60", "m", "profil")
    late = _need_profile(admin, profil, "6", "2026-11-20")
    early = _need_profile(admin, profil, "6", "2026-11-05")
    _stock_in(admin, profil, 2)
    r = admin.post(f"{M}/plan/to-requests/", {"product_ids": [profil["id"]]}, format="json")
    assert r.status_code == 200, r.content
    by_project = {x["project"]: x for x in r.json()["requests"]}
    reqs = {PurchaseRequest.objects.get(pk=x["id"]).project_id: PurchaseRequest.objects.get(pk=x["id"])
            for x in by_project.values()}
    assert reqs[early["id"]].lines.get().qty == D("4.00") and reqs[late["id"]].lines.get().qty == D("6.00")
    plan = admin.get(f"{M}/plan/", {"only_short": "true"}).json()
    assert plan["short"] == 0  # requested quantities now count


def test_mrp_needs_its_page(api, admin):
    from apps.procurement.tests import _user_with

    viewer = _user_with(api, admin, "sotuvchi", {"projects": {"can_view": True}})
    assert viewer.get(f"{M}/plan/").status_code == 403
