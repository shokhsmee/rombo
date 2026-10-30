"""add-inventory: the scenarios of openspec/changes/add-inventory/specs/{inventory,procurement,projects}/spec.md
at API level."""

import datetime as dt
from decimal import Decimal

import pytest

from apps.accounting import selectors as ledger
from apps.accounting.models import JournalLine
from apps.accounting.seed import seed_chart
from apps.company.models import Company
from apps.inventory.models import Product, StockMove, Warehouse
from apps.procurement.tests import EDIT, _project, _send, _usd_order, _user_with
from conftest import API

INV = f"{API}/inventory"
D = Decimal


@pytest.fixture(autouse=True)
def _chart(db):
    seed_chart()


# ------------------------------------------------------------------ helpers


def _product(admin, name="Profil 60 mm", unit="m", category="profil", **extra):
    r = admin.post(f"{INV}/products/", {"name": name, "unit": unit, "category": category, **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _move(admin, expect=201, **body):
    body.setdefault("date", "2026-10-20")
    r = admin.post(f"{INV}/moves/", body, format="json")
    assert r.status_code == expect, r.content
    return r.json()


def _post(admin, move_id, expect=200):
    r = admin.post(f"{INV}/moves/{move_id}/post/")
    assert r.status_code == expect, r.content
    return r.json()


def _posted(admin, **body):
    return _post(admin, _move(admin, **body)["id"])


def _stock_in(admin, product, qty, cost, **extra):
    """Opening stock the way the storekeeper brings it in: a surplus adjustment (Dt 1010 Kt 9390)."""
    return _posted(admin, type="adjust", product_id=product["id"], qty=str(qty), unit_cost=str(cost), **extra)


def _stock(admin, **params):
    r = admin.get(f"{INV}/stock/", params)
    assert r.status_code == 200, r.content
    return r.json()


def _qty(admin, product, warehouse=None) -> D:
    rows = [r for r in _stock(admin, nonzero="false")["rows"] if r["product"]["id"] == product["id"]
            and (warehouse is None or r["warehouse"]["id"] == warehouse)]
    return sum((D(r["qty"]) for r in rows), D("0"))


def _lines(entry_id) -> list[tuple[str, D, D]]:
    return sorted((ln.account.code, ln.debit, ln.credit)
                  for ln in JournalLine.objects.filter(entry_id=entry_id).select_related("account"))


def _received(admin):
    """Spec scenario: 100 bars × 20 USD at 12 000, VAT 12 % → kirim row of 24 000 000 so'm."""
    order, _, _, project = _usd_order(admin)
    _send(admin, order["id"])
    r = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"], "date": "2026-10-15"}, format="json")
    assert r.status_code == 201, r.content
    receipt = r.json()
    r = admin.post(f"{API}/procurement/receipts/{receipt['id']}/post/")
    assert r.status_code == 200, r.content
    return r.json(), project


# ------------------------------------------------------------------ warehouses and products


def test_default_warehouse_created_by_first_receipt(admin):
    assert not Warehouse.objects.exists()
    receipt, _ = _received(admin)
    w = Warehouse.objects.get()
    assert (w.name, w.is_default) == ("Asosiy ombor", True)
    assert receipt["warehouse"]["name"] == "Asosiy ombor"


def test_one_default_warehouse(admin):
    a = admin.post(f"{INV}/warehouses/", {"name": "Asosiy ombor"}, format="json").json()
    b = admin.post(f"{INV}/warehouses/", {"name": "Sex ombori", "is_default": True}, format="json").json()
    rows = {w["id"]: w for w in admin.get(f"{INV}/warehouses/").json()}
    assert rows[a["id"]]["is_default"] is False and rows[b["id"]]["is_default"] is True


def test_product_code_and_on_hand(admin):
    p = _product(admin)
    assert p["code"] == f"MH-{p['id']:05d}"
    _stock_in(admin, p, 10, 5000)
    row = admin.get(f"{INV}/products/", {"q": "Profil"}).json()["items"][0]
    assert (D(row["qty_on_hand"]), D(row["value_on_hand"]), D(row["avg_cost"])) == (D("10"), D("50000"), D("5000"))


# ------------------------------------------------------------------ receipt from procurement


def test_receipt_posting_fills_the_warehouse(admin):
    receipt, project = _received(admin)
    moves = admin.get(f"{INV}/moves/", {"source_model": "procurement.goodsreceipt", "source_id": receipt["id"]}).json()
    assert moves["total"] == 1
    m = moves["items"][0]
    assert (m["type"], m["status"], D(m["qty"]), D(m["amount"])) == ("receipt", "posted", D("100"), D("24000000"))
    assert m["source_label"] == receipt["code"] and m["code"].startswith("OM-")
    product = Product.objects.get(pk=m["product"]["id"])
    assert (product.name, product.category) == ("Profil", "profil")  # created from the line, category guessed
    assert _qty(admin, m["product"]) == D("100")
    # one source of truth: the stock value equals the stock account
    assert D(_stock(admin)["total_value"]) == ledger.account_balance("materials") == D("24000000")
    assert receipt["stock_moves"] == 1


def test_second_receipt_reuses_the_product(admin):
    _received(admin)
    _received(admin)
    assert Product.objects.filter(name="Profil").count() == 1
    assert _qty(admin, {"id": Product.objects.get(name="Profil").pk}) == D("200")


def test_receipt_into_chosen_warehouse(admin):
    w = admin.post(f"{INV}/warehouses/", {"name": "Sex ombori"}, format="json").json()
    order, _, _, _ = _usd_order(admin)
    _send(admin, order["id"])
    rc = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"], "date": "2026-10-15"},
                    format="json").json()
    r = admin.patch(f"{API}/procurement/receipts/{rc['id']}/", {"warehouse_id": w["id"]}, format="json")
    assert r.status_code == 200, r.content
    admin.post(f"{API}/procurement/receipts/{rc['id']}/post/")
    assert _qty(admin, {"id": Product.objects.get(name="Profil").pk}, w["id"]) == D("100")


def test_receipt_typed_by_hand_is_refused(admin):
    p = _product(admin)
    r = admin.post(f"{INV}/moves/", {"type": "receipt", "product_id": p["id"], "qty": "5"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "type"


def test_receipt_rows_cancel_only_through_the_receipt(admin):
    receipt, _ = _received(admin)
    m = StockMove.objects.get(source_id=receipt["id"])
    r = admin.post(f"{INV}/moves/{m.pk}/cancel/", {"comment": "xato"}, format="json")
    assert r.status_code == 409


def test_cancel_receipt_cancels_its_rows(admin):
    receipt, _ = _received(admin)
    r = admin.post(f"{API}/procurement/receipts/{receipt['id']}/cancel/", {"comment": "noto'g'ri"}, format="json")
    assert r.status_code == 200, r.content
    assert StockMove.objects.get(source_id=receipt["id"]).status == "cancelled"
    assert D(_stock(admin)["total_value"]) == D("0") == ledger.account_balance("materials")


def test_cancel_receipt_after_the_goods_were_used(admin):
    receipt, project = _received(admin)
    profil = {"id": Product.objects.get(name="Profil").pk}
    _posted(admin, type="issue", product_id=profil["id"], qty="30", project_id=project["id"])
    r = admin.post(f"{API}/procurement/receipts/{receipt['id']}/cancel/", {"comment": "noto'g'ri"}, format="json")
    assert r.status_code == 409, r.content
    assert admin.get(f"{API}/procurement/receipts/{receipt['id']}/").json()["status"] == "posted"
    assert StockMove.objects.get(source_id=receipt["id"]).status == "posted"


# ------------------------------------------------------------------ issue, average cost, stock


def test_issue_without_project(admin):
    p = _product(admin)
    _stock_in(admin, p, 10, 1000)
    r = admin.post(f"{INV}/moves/", {"type": "issue", "product_id": p["id"], "qty": "1"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "project"


def test_issue_posts_wip_and_derives_stock(admin):
    receipt, project = _received(admin)
    profil = {"id": Product.objects.get(name="Profil").pk}
    m = _posted(admin, type="issue", product_id=profil["id"], qty="30", project_id=project["id"])
    assert (D(m["unit_cost"]), D(m["amount"])) == (D("240000"), D("7200000"))
    assert _lines(m["entry_id"]) == [("1010", D("0"), D("7200000")), ("2010", D("7200000"), D("0"))]
    assert JournalLine.objects.filter(entry_id=m["entry_id"], project_id=project["id"]).count() == 2
    assert _qty(admin, profil) == D("70")
    assert D(_stock(admin)["total_value"]) == D("16800000") == ledger.account_balance("materials")


def test_average_cost_and_last_issue_takes_the_rest(admin):
    p = _product(admin, unit="m")
    project = _project(admin)
    _stock_in(admin, p, 100, 10000)
    _stock_in(admin, p, 100, 12000)
    m = _posted(admin, type="issue", product_id=p["id"], qty="50", project_id=project["id"])
    assert (D(m["unit_cost"]), D(m["amount"])) == (D("11000"), D("550000"))
    _stock_in(admin, p, 1, D("0.01"))  # an odd cost leaves kopecks in the average
    last = _posted(admin, type="issue", product_id=p["id"], qty="151", project_id=project["id"])
    assert D(last["amount"]) == D("2200000") - D("550000") + D("0.01")
    assert ledger.account_balance("materials") == D("0") and D(_stock(admin)["total_value"]) == D("0")


def test_over_issue(admin):
    p = _product(admin)
    project = _project(admin)
    _stock_in(admin, p, 70, 1000)
    m = _move(admin, type="issue", product_id=p["id"], qty="80", project_id=project["id"])
    r = admin.post(f"{INV}/moves/{m['id']}/post/")
    assert r.status_code == 409 and "Omborda yetarli emas" in r.json()["error"]["message"]


def test_transfer_moves_stock_without_entry(admin):
    p = _product(admin)
    _stock_in(admin, p, 10, 1000)
    main = Warehouse.objects.get(is_default=True)
    sex = admin.post(f"{INV}/warehouses/", {"name": "Sex ombori"}, format="json").json()
    m = _posted(admin, type="transfer", product_id=p["id"], qty="4", warehouse_id=main.pk, to_warehouse_id=sex["id"])
    assert m["entry_id"] is None
    assert (_qty(admin, p, main.pk), _qty(admin, p, sex["id"])) == (D("6"), D("4"))
    rows = _stock(admin, warehouse=sex["id"])["rows"]
    assert len(rows) == 1 and D(rows[0]["value"]) == D("4000")
    same = _move(admin, expect=400, type="transfer", product_id=p["id"], qty="1", warehouse_id=main.pk,
                 to_warehouse_id=main.pk)
    assert same["error"]["field"] == "to_warehouse"


def test_shortage_adjustment(admin):
    p = _product(admin)
    _stock_in(admin, p, 10, 1000)
    m = _posted(admin, type="adjust", product_id=p["id"], qty="-2")
    assert (D(m["qty"]), D(m["amount"])) == (D("-2"), D("-2000"))
    assert _lines(m["entry_id"]) == [("1010", D("0"), D("2000")), ("9430", D("2000"), D("0"))]
    assert _qty(admin, p) == D("8")


# ------------------------------------------------------------------ output and delivery


def test_output_from_wip_and_delivery_cogs(admin):
    project = _project(admin)
    profil, oyna = _product(admin), _product(admin, name="Oyna 4 mm", unit="m2", category="oyna")
    window = _product(admin, name="Deraza 1200×1500", unit="dona", category="tayyor")
    _stock_in(admin, profil, 100, 20000)
    _stock_in(admin, oyna, 10, 50000)
    _posted(admin, type="issue", product_id=profil["id"], qty="100", project_id=project["id"])
    _posted(admin, type="issue", product_id=oyna["id"], qty="10", project_id=project["id"])
    pid = project["id"]
    out = _posted(admin, type="output", product_id=window["id"], qty="1", project_id=pid)
    assert D(out["amount"]) == D("2500000")
    assert _lines(out["entry_id"]) == [("2010", D("0"), D("2500000")), ("2810", D("2500000"), D("0"))]
    detail = admin.get(f"{API}/projects/{pid}/").json()
    assert D(detail["stock"]["wip"]) == D("0")

    dl = _posted(admin, type="delivery", product_id=window["id"], qty="1", project_id=pid)
    assert D(dl["amount"]) == D("2500000")
    assert dl["partner"]["id"] == project["client_id"]
    assert _lines(dl["entry_id"]) == [("2810", D("0"), D("2500000")), ("9110", D("2500000"), D("0"))]
    cogs = JournalLine.objects.get(entry_id=dl["entry_id"], account__code="9110")
    assert (cogs.project_id, cogs.partner_id) == (pid, project["client_id"])


def test_output_needs_finished_product_and_wip(admin):
    project = _project(admin)
    profil = _product(admin)
    window = _product(admin, name="Deraza", unit="dona", category="tayyor")
    bad = _move(admin, expect=400, type="output", product_id=profil["id"], qty="1", project_id=project["id"])
    assert bad["error"]["field"] == "product"
    m = _move(admin, type="output", product_id=window["id"], qty="1", project_id=project["id"])
    r = admin.post(f"{INV}/moves/{m['id']}/post/")
    assert r.status_code == 409  # nothing issued to the Loyiha yet


# ------------------------------------------------------------------ cancel, lock date, drafts


def test_cancel_reverses(admin):
    p = _product(admin)
    project = _project(admin)
    _stock_in(admin, p, 10, 1000)
    m = _posted(admin, type="issue", product_id=p["id"], qty="4", project_id=project["id"])
    r = admin.post(f"{INV}/moves/{m['id']}/cancel/", {"comment": ""}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "comment"
    r = admin.post(f"{INV}/moves/{m['id']}/cancel/", {"comment": "noto'g'ri loyiha"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert _qty(admin, p) == D("10")
    assert ledger.account_balance("wip") == D("0") and ledger.account_balance("materials") == D("10000")


def test_cancel_surplus_after_it_was_used(admin):
    p = _product(admin)
    project = _project(admin)
    s = _stock_in(admin, p, 10, 1000)
    _posted(admin, type="issue", product_id=p["id"], qty="8", project_id=project["id"])
    r = admin.post(f"{INV}/moves/{s['id']}/cancel/", {"comment": "xato"}, format="json")
    assert r.status_code == 409


def test_closed_period(admin):
    p = _product(admin)
    c = Company.get()
    c.lock_date = dt.date(2026, 10, 25)
    c.save()
    m = _move(admin, type="adjust", product_id=p["id"], qty="5", unit_cost="100", date="2026-10-20")
    r = admin.post(f"{INV}/moves/{m['id']}/post/")
    assert r.status_code == 409


def test_draft_edit_delete_and_posted_frozen(admin):
    p = _product(admin)
    m = _move(admin, type="adjust", product_id=p["id"], qty="5", unit_cost="100")
    assert m["status"] == "draft" and m["on_hand"] == {"qty": "0", "avg_cost": None}
    r = admin.patch(f"{INV}/moves/{m['id']}/", {"qty": "6"}, format="json")
    assert r.status_code == 200 and D(r.json()["qty"]) == D("6")
    _post(admin, m["id"])
    r = admin.patch(f"{INV}/moves/{m['id']}/", {"qty": "7"}, format="json")
    assert r.status_code == 409
    assert admin.delete(f"{INV}/moves/{m['id']}/").status_code == 409
    d = _move(admin, type="adjust", product_id=p["id"], qty="1", unit_cost="100")
    assert admin.delete(f"{INV}/moves/{d['id']}/").status_code == 204


# ------------------------------------------------------------------ list, summary, Loyiha card, access


def test_summary_follows_the_filter(admin):
    p = _product(admin)
    a, b = _project(admin), _project(admin)
    _stock_in(admin, p, 10, 1000)
    _posted(admin, type="issue", product_id=p["id"], qty="3", project_id=a["id"])
    _posted(admin, type="issue", product_id=p["id"], qty="2", project_id=b["id"])
    s = admin.get(f"{INV}/moves/summary/", {"project": a["id"]}).json()
    assert (s["count"], D(s["chiqim"]), D(s["kirim"])) == (1, D("3000"), D("0"))
    s = admin.get(f"{INV}/moves/summary/").json()
    assert (s["count"], D(s["kirim"]), D(s["chiqim"]), D(s["stock_value"])) == (3, D("10000"), D("5000"), D("5000"))
    rows = admin.get(f"{INV}/moves/", {"type": ["issue"], "project": a["id"]}).json()
    assert rows["total"] == 1


def test_card_shows_what_went_into_the_order(admin):
    p = _product(admin)
    project = _project(admin)
    _stock_in(admin, p, 10, 500000)
    _posted(admin, type="issue", product_id=p["id"], qty="1", project_id=project["id"])
    _posted(admin, type="issue", product_id=p["id"], qty="2", project_id=project["id"])
    stock = admin.get(f"{API}/projects/{project['id']}/").json()["stock"]
    assert stock["moves"] == 2
    assert (D(stock["issued"]), D(stock["output"]), D(stock["delivered"]), D(stock["wip"])) == (
        D("1500000"), D("0"), D("0"), D("1500000"))


def test_viewer_cannot_post(api, admin):
    p = _product(admin)
    m = _move(admin, type="adjust", product_id=p["id"], qty="5", unit_cost="100")
    viewer = _user_with(api, admin, "omborkuzatuvchi", {"inventory": {"can_view": True}, "stock": {"can_view": True}})
    assert viewer.get(f"{INV}/moves/").status_code == 200
    assert viewer.get(f"{INV}/products/").status_code == 200  # the move form picks products
    assert viewer.post(f"{INV}/moves/{m['id']}/post/").status_code == 403
    keeper = _user_with(api, admin, "omborchi", {"inventory": EDIT})
    assert keeper.post(f"{INV}/moves/{m['id']}/post/").status_code == 200
