from decimal import Decimal

import pytest
from django.apps import apps
from django.core import mail

from apps.projects.test_calc import SAMPLE_QTY, _calc, _fill_sample
from conftest import API, login

ACCOUNTING = apps.is_installed("apps.accounting")
needs_accounting = pytest.mark.skipif(not ACCOUNTING, reason="add-accounting is not on this branch yet")


# ------------------------------------------------------------------ helpers


def _supplier(admin, name="AKFA", **extra):
    r = admin.post(f"{API}/procurement/suppliers/", {"name": name, "price_currency": "USD", **extra},
                   format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _project(admin, status="confirmed", **extra):
    c = admin.post(f"{API}/clients/", {"name": "Ali Valiyev", "phone": "+998901112233"}, format="json").json()
    p = admin.post(f"{API}/projects/", {"name": "Uy derazalari", "client_id": c["id"], **extra},
                   format="json").json()
    if status != "draft":
        r = admin.post(f"{API}/projects/{p['id']}/status/", {"status": status}, format="json")
        assert r.status_code == 200, r.content
    return p


LINES = [{"name": "Profil 60 mm", "unit": "dona", "qty": "100"}, {"name": "Oyna 4 mm", "unit": "m2",
                                                                  "qty": "40"}]


def _request(client, project_id, lines=LINES, **extra):
    r = client.post(f"{API}/procurement/requests/", {"project_id": project_id, "lines": lines, **extra},
                    format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _approved_request(admin, project_id, lines=LINES):
    req = _request(admin, project_id, lines)
    r = admin.post(f"{API}/procurement/requests/{req['id']}/submit/")  # admin holds purchase_approve: auto
    assert r.status_code == 200 and r.json()["status"] == "approved", r.content
    return r.json()


def _order_from(admin, req, supplier, lines=None):
    rows = lines or [{"request_line_id": ln["id"], "supplier_id": supplier["id"]} for ln in req["lines"]]
    r = admin.post(f"{API}/procurement/orders/from-requests/", {"lines": rows}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _usd_order(admin, project=None, qty="100", price="20", vat="12", rate="12000"):
    """100 bars × 20 USD, VAT 12 %, rate 12 000 → gross 2 240 USD = 26 880 000 so'm (spec scenario)."""
    sup = _supplier(admin, email="sales@akfa.uz")
    project = project or _project(admin)
    req = _approved_request(admin, project["id"], [{"name": "Profil", "unit": "dona", "qty": qty}])
    order = _order_from(admin, req, sup)[0]
    r = admin.patch(f"{API}/procurement/orders/{order['id']}/", {
        "currency": "USD", "rate": rate,
        "lines": [{**_line_input(ln), "price": price, "vat_rate": vat} for ln in order["lines"]],
    }, format="json")
    assert r.status_code == 200, r.content
    return r.json(), req, sup, project


def _line_input(ln):
    return {"request_line_id": ln["request_line_id"], "name": ln["name"], "unit": ln["unit"],
            "qty": ln["qty"],
            "price": ln["price"], "vat_rate": ln["vat_rate"]}


def _send(admin, order_id, via="print", **extra):
    r = admin.post(f"{API}/procurement/orders/{order_id}/send/", {"via": via, **extra}, format="json")
    assert r.status_code == 200, r.content
    return r.json()


def _balance(admin, sup) -> str:
    return admin.get(f"{API}/procurement/suppliers/{sup['id']}/").json()["balance_uzs"]


def _history(admin, model, pk):
    return admin.get(f"{API}/chatter/", {"model": model, "res_id": pk}).json()


def _user_with(api, admin, username, pages: dict[str, dict]):
    role = admin.post(f"{API}/access/roles/", {
        "name": f"Rol {username}", "permissions": [{"page_key": p, **flags} for p, flags in pages.items()],
    }, format="json").json()
    admin.post(f"{API}/users/", {"username": username, "first_name": "Test", "password": "password123",
                                 "role_ids": [role["id"]]}, format="json")
    return login(api, username, "password123")


EDIT = {"can_view": True, "can_create": True, "can_update": True}
BUYER_PAGES = {"procurement": EDIT, "purchase_orders": EDIT, "goods_receipts": EDIT, "suppliers": EDIT,
               "projects": {"can_view": True}}


# ------------------------------------------------------------------ suppliers


def test_suppliers_are_clients_hidden_from_the_sales_list(admin):
    sup = _supplier(admin, bank_account="20208000900000000001", mfo="00014", prepay_percent=50,
                    credit_days=30)
    assert sup["code"].startswith("MJ-") and sup["kind"] == "supplier"
    assert sup["balance_uzs"] == "0" and sup["prepay_percent"] == 50

    assert admin.get(f"{API}/clients/").json()["total"] == 0
    assert admin.get(f"{API}/clients/", {"kind": "supplier"}).json()["total"] == 1
    assert admin.get(f"{API}/clients/", {"kind": "dealer"}).json()["total"] == 0
    assert admin.get(f"{API}/procurement/suppliers/", {"q": "akfa"}).json()["total"] == 1
    # the client card shows the same row with the supplier fields
    card = admin.get(f"{API}/clients/{sup['id']}/").json()
    assert card["kind"] == "supplier" and card["mfo"] == "00014"


def test_order_needs_a_supplier_not_a_customer(admin):
    p = _project(admin)
    r = admin.post(f"{API}/procurement/orders/", {"supplier_id": p["client"]["id"]}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "supplier_id"


# ------------------------------------------------------------------ requests


def test_request_from_calc_copies_lines_with_quantities(admin):
    p = _project(admin, status="draft", currency="USD")
    calc = _fill_sample(admin, p["id"], _calc(admin, p["id"]))
    req = _request(admin, p["id"], lines=[])
    assert req["code"].startswith("XS-")

    r = admin.post(f"{API}/procurement/requests/{req['id']}/from-calc/", {"calc_id": calc["id"]},
                   format="json")
    assert r.status_code == 200, r.content
    lines = r.json()["lines"]
    assert len(lines) == len(SAMPLE_QTY) == 15
    assert {ln["name"]: ln["qty"] for ln in lines}["L -ka"] == "4.50"
    assert all(ln["item_id"] for ln in lines) and lines[0]["unit"] == "шт"
    assert _history(admin, "procurement.purchaserequest",
                    req["id"])[0]["body"].startswith("Hisob-kitobdan olindi")


def test_submit_by_approver_is_approved_at_once(admin):
    p = _project(admin)
    req = _approved_request(admin, p["id"])
    bodies = [m["body"] for m in _history(admin, "procurement.purchaserequest", req["id"])]
    assert bodies[0] == "Tasdiqlandi"
    assert req["approved_by"]["full_name"] and req["allowed_statuses"] == ["cancelled"]
    # lines lock outside draft
    r = admin.patch(f"{API}/procurement/requests/{req['id']}/", {"lines": []}, format="json")
    assert r.status_code == 409


def test_submit_by_buyer_waits_for_an_approver(api, admin):
    buyer = _user_with(api, admin, "buyer", BUYER_PAGES)
    approver = _user_with(api, admin, "director", {**BUYER_PAGES, "purchase_approve": {"can_view": True,
                                                                                       "can_update": True}})
    p = _project(admin)
    req = _request(buyer, p["id"])
    assert req["requester"]["full_name"] == "Test"

    empty = _request(buyer, p["id"], lines=[])
    r = buyer.post(f"{API}/procurement/requests/{empty['id']}/submit/")
    assert r.status_code == 400 and r.json()["error"]["field"] == "lines"

    r = buyer.post(f"{API}/procurement/requests/{req['id']}/submit/")
    assert r.status_code == 200 and r.json()["status"] == "submitted"
    assert [i["id"] for i in buyer.get(f"{API}/procurement/requests/",
                                       {"needs_approval": "true"}).json()["items"]] == [req["id"]]

    assert buyer.post(f"{API}/procurement/requests/{req['id']}/approve/").status_code == 403
    bad = approver.post(f"{API}/procurement/requests/{req['id']}/reject/", {}, format="json")
    assert bad.status_code == 400 and bad.json()["error"]["field"] == "comment"

    r = approver.post(f"{API}/procurement/requests/{req['id']}/reject/", {"comment": "Narxi yuqori"},
                      format="json")
    assert r.json()["status"] == "rejected"
    assert _history(admin, "procurement.purchaserequest", req["id"])[0]["body"] == "Rad etildi: Narxi yuqori"
    assert buyer.post(f"{API}/procurement/requests/{req['id']}/reopen/").json()["status"] == "draft"
    buyer.post(f"{API}/procurement/requests/{req['id']}/submit/")
    r = approver.post(f"{API}/procurement/requests/{req['id']}/approve/", {"comment": "OK"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "approved"


def test_order_from_request_splits_by_supplier_and_marks_it_ordered(admin):
    p = _project(admin)
    akfa, glass = _supplier(admin, "AKFA"), _supplier(admin, "Oyna zavodi", price_currency="UZS")
    req = _approved_request(admin, p["id"])
    profile, oyna = req["lines"]
    orders = _order_from(admin, req, akfa, lines=[
        {"request_line_id": profile["id"], "supplier_id": akfa["id"]},
        {"request_line_id": oyna["id"], "supplier_id": glass["id"]},
    ])
    assert len(orders) == 2 and {o["supplier"]["name"] for o in orders} == {"AKFA", "Oyna zavodi"}
    assert all(o["status"] == "draft" and o["code"].startswith("XB-") for o in orders)
    assert all(o["project"]["id"] == p["id"] for o in orders)
    by_sup = {o["supplier"]["name"]: o for o in orders}
    assert by_sup["AKFA"]["currency"] == "USD" and by_sup["Oyna zavodi"]["currency"] == "UZS"
    assert by_sup["AKFA"]["lines"][0]["project"]["id"] == p["id"]

    req = admin.get(f"{API}/procurement/requests/{req['id']}/").json()
    assert req["status"] == "ordered"
    assert [ln["ordered_qty"] for ln in req["lines"]] == ["100.00", "40.00"]

    # a second order for the same line is refused: nothing is left
    r = admin.post(f"{API}/procurement/orders/from-requests/", {"lines": [
        {"request_line_id": profile["id"], "supplier_id": akfa["id"]}]}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "lines"

    # cancelling an order gives the quantity back and the request is approved again
    r = admin.post(f"{API}/procurement/orders/{by_sup['AKFA']['id']}/cancel/", {"comment": "AKFA yo'q"},
                   format="json")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    req = admin.get(f"{API}/procurement/requests/{req['id']}/").json()
    assert req["status"] == "approved" and req["lines"][0]["ordered_qty"] == "0.00"


def test_partial_order_from_request(admin):
    p = _project(admin)
    sup = _supplier(admin)
    req = _approved_request(admin, p["id"], [{"name": "Profil", "unit": "dona", "qty": "100"}])
    order = _order_from(admin, req, sup, lines=[{"request_line_id": req["lines"][0]["id"],
                                                 "supplier_id": sup["id"],
                                                  "qty": "60"}])[0]
    assert order["lines"][0]["qty"] == "60.00"
    req = admin.get(f"{API}/procurement/requests/{req['id']}/").json()
    assert req["status"] == "approved" and req["lines"][0]["remaining_qty"] == "40.00"


# ------------------------------------------------------------------ orders


def test_order_totals_in_two_currencies(admin):
    order, *_ = _usd_order(admin)
    t = order["totals"]
    assert (t["net"], t["vat"], t["gross"]) == ("2000.00", "240.00", "2240.00")
    assert t["gross_uzs"] == "26880000.00" and order["lines"][0]["gross"] == "2240.00"
    listed = admin.get(f"{API}/procurement/orders/", {"q": order["code"]}).json()["items"][0]
    assert listed["totals"]["gross_uzs"] == "26880000.00"


def test_usd_order_needs_a_rate_to_be_sent(admin):
    order, *_ = _usd_order(admin, rate=None)
    r = admin.post(f"{API}/procurement/orders/{order['id']}/send/", {"via": "print"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "rate"


def test_send_print_moves_the_loyiha_and_locks_the_lines(admin):
    order, req, sup, project = _usd_order(admin)
    assert admin.get(f"{API}/projects/{project['id']}/").json()["status"] == "confirmed"

    sent = _send(admin, order["id"], via="print", note="Kuryer olib ketdi")
    assert sent["status"] == "sent" and sent["sent_via"] == "print" and sent["sent_by"]["full_name"]
    assert sent["sent_at"] and sent["allowed_statuses"] == ["cancelled"]
    hist = _history(admin, "procurement.purchaseorder", order["id"])
    assert hist[0]["body"] == "Yuborildi: Chop etib. Kuryer olib ketdi"
    assert hist[1]["changes"] == [{"field": "status", "label": "Holat", "old": "Qoralama",
                                   "new": "Yuborilgan"}]

    p = admin.get(f"{API}/projects/{project['id']}/").json()
    assert p["status"] == "procurement"
    assert _history(admin, "projects.project", project["id"])[0]["changes"] == [
        {"field": "status", "label": "Holat", "old": "Tasdiqlangan", "new": "Xaridda"}]
    assert p["procurement"] == {"requests": 1, "orders": 1, "received_pct": 0}

    # lines are what the supplier has on paper
    r = admin.patch(f"{API}/procurement/orders/{order['id']}/", {"lines": []}, format="json")
    assert r.status_code == 409
    assert r.json()["error"]["message"] == ("Yuborilgan buyurtma o'zgartirilmaydi — "
                                            "bekor qilib yangisini oching")
    assert admin.patch(f"{API}/procurement/orders/{order['id']}/", {"notes": "tel: 90"},
                       format="json").status_code == 200

    # sending again keeps the status and adds a line; a Loyiha already in procurement is left alone
    again = _send(admin, order["id"], via="other", to="Telegram")
    assert again["status"] == "sent" and again["sent_to"] == "Telegram"
    assert _history(admin, "procurement.purchaseorder",
                    order["id"])[0]["body"] == "Yuborildi: Boshqa → Telegram"
    assert admin.get(f"{API}/projects/{project['id']}/").json()["status"] == "procurement"


def test_send_email_needs_configuration_then_mails_the_order(admin, settings):
    order, req, sup, project = _usd_order(admin)
    settings.EMAIL_HOST = ""
    r = admin.post(f"{API}/procurement/orders/{order['id']}/send/", {"via": "email"}, format="json")
    assert r.status_code == 409 and r.json()["error"]["message"] == "Email sozlanmagan"
    assert admin.get(f"{API}/procurement/orders/{order['id']}/").json()["status"] == "draft"
    assert admin.get(f"{API}/projects/{project['id']}/").json()["status"] == "confirmed"

    settings.EMAIL_HOST = "smtp.example.uz"  # the test runner swaps in the locmem backend
    sent = _send(admin, order["id"], via="email")
    assert sent["status"] == "sent" and sent["sent_to"] == "sales@akfa.uz"
    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    assert msg.to == ["sales@akfa.uz"] and order["code"] in msg.subject
    html = msg.alternatives[0][0]
    assert "Profil" in html and "2240.00" in html and "26880000.00" in html
    assert _history(admin, "procurement.purchaseorder",
                    order["id"])[0]["body"] == "Yuborildi: Email → sales@akfa.uz"

    # no address anywhere → the field is reported
    other = _supplier(admin, "Nomsiz", price_currency="UZS")
    o2 = admin.post(f"{API}/procurement/orders/", {"supplier_id": other["id"], "lines": [
        {"name": "X", "unit": "dona", "qty": "1", "price": "1"}]}, format="json").json()
    r = admin.post(f"{API}/procurement/orders/{o2['id']}/send/", {"via": "email"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "to"


def test_send_needs_lines(admin):
    sup = _supplier(admin)
    o = admin.post(f"{API}/procurement/orders/", {"supplier_id": sup["id"], "currency": "UZS"},
                   format="json").json()
    r = admin.post(f"{API}/procurement/orders/{o['id']}/send/", {"via": "print"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "lines"
    assert admin.get(f"{API}/procurement/orders/{o['id']}/html/").status_code == 200


def test_orders_are_found_by_loyiha_code_on_their_lines(admin):
    order, req, sup, project = _usd_order(admin)
    admin.patch(f"{API}/procurement/orders/{order['id']}/", {"project_id": None}, format="json")
    found = admin.get(f"{API}/procurement/orders/", {"q": project["code"]}).json()
    assert [o["id"] for o in found["items"]] == [order["id"]]
    assert admin.get(f"{API}/procurement/orders/", {"project": project["id"]}).json()["total"] == 1
    assert admin.get(f"{API}/procurement/requests/", {"q": "profil"}).json()["total"] == 1


# ------------------------------------------------------------------ receipts


def test_receipt_prefills_remaining_and_refuses_over_receipt(admin):
    order, *_ = _usd_order(admin)
    r = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"]}, format="json")
    assert r.status_code == 409  # a draft order has not gone to the supplier yet
    _send(admin, order["id"])

    r = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"], "invoice_number": "ESF-17"},
                   format="json")
    assert r.status_code == 201, r.content
    rec = r.json()
    assert rec["code"].startswith("KR-") and rec["status"] == "draft" and rec["supplier"]["name"] == "AKFA"
    ln = rec["lines"][0]
    assert (ln["qty"], ln["price"], ln["vat_rate"], ln["ordered_qty"]) == ("100.00", "20.00", "12.00",
                                                                           "100.00")
    assert rec["totals"]["gross_uzs"] == "26880000.00" and rec["currency"] == "USD"
    assert rec["storekeeper"]["full_name"] and rec["allowed_statuses"] == ["posted"]

    over = admin.patch(f"{API}/procurement/receipts/{rec['id']}/", {"lines": [
        {"order_line_id": ln["order_line_id"], "qty": "101"}]}, format="json")
    assert over.status_code == 400 and over.json()["error"]["field"] == "lines"
    r = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"], "lines": [
        {"order_line_id": ln["order_line_id"], "qty": "150"}]}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "lines"

    assert admin.get(f"{API}/procurement/receipts/", {"q": "ESF-17"}).json()["total"] == 1
    assert admin.delete(f"{API}/procurement/receipts/{rec['id']}/").status_code == 204


@pytest.mark.skipif(ACCOUNTING, reason="with accounting installed posting works; see the tests below")
def test_posting_without_accounting_is_refused(admin):
    order, *_ = _usd_order(admin)
    _send(admin, order["id"])
    rec = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"]}, format="json").json()
    r = admin.post(f"{API}/procurement/receipts/{rec['id']}/post/")
    assert r.status_code == 409
    assert admin.get(f"{API}/procurement/orders/{order['id']}/").json()["status"] == "sent"


# ------------------------------------------------------------------ posting (needs add-accounting)


def _entry_lines(entry_id):
    from apps.accounting.models import JournalLine

    return list(JournalLine.objects.filter(entry_id=entry_id).select_related("account").order_by("id"))


def _by_code(lines):
    out = {}
    for ln in lines:
        d = out.setdefault(ln.account.code, {"debit": Decimal("0"), "credit": Decimal("0")})
        d["debit"] += ln.debit
        d["credit"] += ln.credit
    return out


@needs_accounting
def test_posting_writes_the_ledger_and_the_received_qty(admin):
    order, req, sup, project = _usd_order(admin)
    _send(admin, order["id"])
    rec = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"]}, format="json").json()
    r = admin.post(f"{API}/procurement/receipts/{rec['id']}/post/")
    assert r.status_code == 200, r.content
    posted = r.json()
    assert posted["status"] == "posted" and posted["entry_id"] and posted["posted_by"]["full_name"]

    lines = _entry_lines(posted["entry_id"])
    assert _by_code(lines) == {
        "1010": {"debit": Decimal("24000000.00"), "credit": Decimal("0")},
        "4410": {"debit": Decimal("2880000.00"), "credit": Decimal("0")},
        "6010": {"debit": Decimal("0"), "credit": Decimal("26880000.00")},
    }
    assert all(ln.partner_id == sup["id"] for ln in lines)
    assert [ln.project_id for ln in lines if ln.account.code == "1010"] == [project["id"]]

    o = admin.get(f"{API}/procurement/orders/{order['id']}/").json()
    assert o["status"] == "received" and o["lines"][0]["received_qty"] == "100.00"
    assert admin.get(f"{API}/projects/{project['id']}/").json()["procurement"]["received_pct"] == 100
    balance = admin.get(f"{API}/procurement/suppliers/{sup['id']}/").json()
    assert Decimal(balance["balance_uzs"]) == Decimal("26880000.00")
    assert admin.post(f"{API}/procurement/orders/{order['id']}/cancel/", {"comment": "x"},
                      format="json").status_code == 409


@needs_accounting
def test_partial_receipts_derive_the_order_status(admin):
    order, req, sup, project = _usd_order(admin)
    _send(admin, order["id"])
    ol = order["lines"][0]["id"]
    first = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"], "lines": [
        {"order_line_id": ol, "qty": "60"}]}, format="json").json()
    assert admin.post(f"{API}/procurement/receipts/{first['id']}/post/").status_code == 200
    o = admin.get(f"{API}/procurement/orders/{order['id']}/").json()
    assert o["status"] == "partially_received" and o["lines"][0]["remaining_qty"] == "40.00"
    assert admin.get(f"{API}/projects/{project['id']}/").json()["procurement"]["received_pct"] == 60

    rest = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"]}, format="json").json()
    assert rest["lines"][0]["qty"] == "40.00"
    assert admin.post(f"{API}/procurement/receipts/{rest['id']}/post/").status_code == 200
    assert admin.get(f"{API}/procurement/orders/{order['id']}/").json()["status"] == "received"

    # cancelling the second receipt reverses its entry and the order is partially received again
    r = admin.post(f"{API}/procurement/receipts/{rest['id']}/cancel/", {"comment": "Qaytarildi"},
                   format="json")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    from apps.accounting.models import JournalEntry

    assert JournalEntry.objects.get(pk=rest["entry_id"]).status == "reversed"
    o = admin.get(f"{API}/procurement/orders/{order['id']}/").json()
    assert o["status"] == "partially_received" and o["lines"][0]["received_qty"] == "60.00"


@needs_accounting
def test_prepayment_is_offset_on_posting(admin):
    from apps.accounting import services as acc
    from apps.clients.models import Client
    from apps.users.models import User

    order, req, sup, project = _usd_order(admin)
    actor = User.objects.get(username="admin")
    acc.entry_post(actor=actor, date=order["date"], memo="Avans AKFA", lines=[
        {"role": "advance_paid", "debit": Decimal("10000000"), "partner": Client.objects.get(pk=sup["id"])},
        {"role": "bank_uzs", "credit": Decimal("10000000")},
    ])
    assert Decimal(_balance(admin, sup)) == Decimal("-10000000")

    _send(admin, order["id"])
    rec = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"]}, format="json").json()
    posted = admin.post(f"{API}/procurement/receipts/{rec['id']}/post/").json()
    codes = _by_code(_entry_lines(posted["entry_id"]))
    assert codes["6010"] == {"debit": Decimal("10000000.00"), "credit": Decimal("26880000.00")}
    assert codes["4310"] == {"debit": Decimal("0"), "credit": Decimal("10000000.00")}
    assert Decimal(_balance(admin, sup)) == Decimal("16880000")


@needs_accounting
def test_posting_into_a_closed_period_is_refused(admin):
    from apps.company.models import Company

    order, *_ = _usd_order(admin)
    _send(admin, order["id"])
    rec = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"]}, format="json").json()
    Company.objects.filter(pk=1).update(lock_date=rec["date"])
    r = admin.post(f"{API}/procurement/receipts/{rec['id']}/post/")
    assert r.status_code == 409
    assert admin.get(f"{API}/procurement/receipts/{rec['id']}/").json()["status"] == "draft"


@needs_accounting
def test_default_price_is_the_last_posted_receipt_price(admin):
    order, req, sup, project = _usd_order(admin)
    item_order = admin.get(f"{API}/procurement/orders/{order['id']}/").json()
    # tie the line to a price-list item so the next order can look the price up
    from apps.pricing.models import PriceListItem
    from apps.procurement.models import PurchaseOrderLine

    item = PriceListItem.objects.first()
    PurchaseOrderLine.objects.filter(pk=item_order["lines"][0]["id"]).update(item=item)
    _send(admin, order["id"])
    rec = admin.post(f"{API}/procurement/receipts/", {"order_id": order["id"]}, format="json").json()
    assert admin.post(f"{API}/procurement/receipts/{rec['id']}/post/").status_code == 200

    o2 = admin.post(f"{API}/procurement/orders/", {"supplier_id": sup["id"], "currency": "USD",
                                                   "rate": "12100",
                                                     "lines": [{"item_id": item.pk, "name": item.name,
                                                                "unit": item.unit,
                                                                "qty": "5"}]}, format="json").json()
    assert o2["lines"][0]["price"] == "20.00"
