"""add-kassa: every scenario of openspec/changes/add-kassa/specs/{kassa,projects}/spec.md at API level."""

from decimal import Decimal

import pytest
from django.core.management import call_command

from apps.accounting import selectors as ledger
from apps.accounting.models import Account
from apps.clients.models import Client
from apps.kassa.models import CashAccount, PaymentPurpose
from conftest import API, login

K = f"{API}/kassa"
ACC = f"{API}/accounting"
D = Decimal


@pytest.fixture
def kas(admin):
    """Admin client with the chart, the purposes and the two default accounts seeded."""
    call_command("seed_accounting", verbosity=0)
    call_command("seed_kassa", verbosity=0)
    return admin


def account_id(code: str) -> int:
    return Account.objects.get(code=code).pk


def kassa_id(name="Asosiy kassa") -> int:
    return CashAccount.objects.get(name=name).pk


def purpose_id(name: str) -> int:
    return PaymentPurpose.objects.get(name=name).pk


def _client(kas, name="Mega Qurilish MChJ", **extra):
    r = kas.post(f"{API}/clients/", {"name": name, "kind": "company", **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _project(kas, client_id, amount="10000000", **extra):
    r = kas.post(f"{API}/projects/", {"name": "Uy derazalari", "client_id": client_id, "amount": amount,
                                       "items": [], **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _employee(kas, last_name="Karimov"):
    r = kas.post(f"{API}/employees/", {"last_name": last_name, "first_name": "Bobur", "position": "Usta"}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _manual(kas, date, memo, lines):
    r = kas.post(f"{ACC}/entries/", {"date": date, "memo": memo, "lines": lines}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _line(code, *, debit=None, credit=None, **extra):
    row = {"account_id": account_id(code), **extra}
    if debit is not None:
        row["debit"] = str(debit)
    if credit is not None:
        row["credit"] = str(credit)
    return row


def _fund(kas, amount="3000000", code="5010", date="2026-10-01"):
    """Opening balance of a kassa the way the accountant enters it: a manual entry against capital."""
    return _manual(kas, date, "Boshlang'ich qoldiq", [_line(code, debit=amount), _line("8330", credit=amount)])


def _order(kas, *, kind="in", purpose=None, amount="1000000", account=None, date="2026-10-10", expect=201, **extra):
    body = {"kind": kind, "amount": str(amount), "account_id": account or kassa_id(), "date": date, **extra}
    if purpose:
        body["purpose_id"] = purpose_id(purpose)
    r = kas.post(f"{K}/orders/", body, format="json")
    assert r.status_code == expect, r.content
    return r.json()


def _post(kas, order_id, expect=200):
    r = kas.post(f"{K}/orders/{order_id}/post/", {}, format="json")
    assert r.status_code == expect, r.content
    return r.json()


def _paid(kas, **kw):
    """Create and post in one go."""
    return _post(kas, _order(kas, **kw)["id"])


def _entry_lines(kas, entry_id) -> set[tuple]:
    e = kas.get(f"{ACC}/entries/{entry_id}/").json()
    return {(ln["account"]["code"], D(ln["debit"]), D(ln["credit"])) for ln in e["lines"]}


def _invoice(kas, *, kind, partner_id, lines, date="2026-10-05", confirm=True, **extra):
    r = kas.post(f"{ACC}/invoices/", {"kind": kind, "partner_id": partner_id, "date": date, "lines": lines, **extra},
                 format="json")
    assert r.status_code == 201, r.content
    inv = r.json()
    if confirm:
        r = kas.post(f"{ACC}/invoices/{inv['id']}/confirm/", {}, format="json")
        assert r.status_code == 200, r.content
        inv = r.json()
    return inv


def _balance(kas, name="Asosiy kassa") -> Decimal:
    return D(next(a for a in kas.get(f"{K}/accounts/").json() if a["name"] == name)["balance"])


def _user_with(api, admin, username, pages: dict[str, list[str]]):
    role = admin.post(f"{API}/access/roles/", {
        "name": f"Rol {username}",
        "permissions": [{"page_key": p, **{f"can_{a}": True for a in actions}} for p, actions in pages.items()],
    }, format="json").json()
    admin.post(f"{API}/users/", {"username": username, "first_name": "Test", "password": "password123",
                                 "role_ids": [role["id"]]}, format="json")
    return login(api, username, "password123")


# ---------------------------------------------------------------- accounts


def test_seed_accounts_and_balance_is_the_ledger(kas):
    accounts = kas.get(f"{K}/accounts/").json()
    assert [(a["name"], a["kind"], a["currency"], a["account"]["code"]) for a in accounts] == [
        ("Asosiy kassa", "cash", "UZS", "5010"), ("Valyuta kassasi", "cash", "USD", "5020"),
        ("Hisob raqami", "bank", "UZS", "5110")]
    assert all(D(a["balance"]) == 0 for a in accounts)
    _fund(kas, "5000000")
    _paid(kas, kind="out", purpose="Xarajat", amount="1200000", basis="Kanselyariya")
    assert _balance(kas) == D("3800000") == ledger.account_balance("cash_uzs")
    s = kas.get(f"{K}/summary/").json()
    assert D(s["total_uzs"]) == D("3800000") and D(s["cash_uzs"]) == D("3800000") and D(s["bank_uzs"]) == 0
    assert D(s["month_out"]) == D("1200000")
    # seeding again changes nothing
    call_command("seed_kassa", verbosity=0)
    assert CashAccount.objects.count() == 3 and PaymentPurpose.objects.count() == 14


def test_account_create_defaults_ledger_account_and_is_unique(kas):
    # the seeded dollar kassa sits on 5020; a USD bank account defaults to 5210
    usd = kas.get(f"{K}/accounts/{kassa_id('Valyuta kassasi')}/").json()
    assert usd["account"]["code"] == "5020"
    r = kas.post(f"{K}/accounts/", {"name": "Valyuta hisobi", "kind": "bank", "currency": "USD"}, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["account"]["code"] == "5210"
    # the same ledger account cannot serve two kassas; a non-5xxx account is refused
    r = kas.post(f"{K}/accounts/", {"name": "Ikkinchi", "kind": "cash", "currency": "UZS"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "account_id"
    r = kas.post(f"{K}/accounts/", {"name": "Noto'g'ri", "account_id": account_id("1010")}, format="json")
    assert r.status_code == 400
    # with posted orders: no delete endpoint, currency locked, deactivation works
    _fund(kas)
    _paid(kas, kind="out", purpose="Xarajat", amount="100")
    kid = kassa_id()
    assert kas.delete(f"{K}/accounts/{kid}/").status_code in (403, 405)  # no delete at all
    assert kas.patch(f"{K}/accounts/{kid}/", {"currency": "USD"}, format="json").status_code == 409
    r = kas.patch(f"{K}/accounts/{kid}/", {"is_active": False, "cash_limit": "5000000"}, format="json")
    assert r.status_code == 200 and r.json()["is_active"] is False and r.json()["has_orders"] is True
    assert kas.get(f"{API}/chatter/", {"model": "kassa.cashaccount", "res_id": kid}).json()[0]["changes"]


# ---------------------------------------------------------------- orders: shape, numbering, statuses


def test_numbering_per_form_and_statuses(kas):
    _fund(kas, "10000000", "5010")
    _fund(kas, "10000000", "5110")
    bank = kassa_id("Hisob raqami")
    draft = _order(kas, kind="in", purpose="Boshqa kirim", amount="100")
    assert draft["code"] is None and draft["status"] == "draft" and draft["allowed_statuses"] == ["posted"]
    pko = _post(kas, draft["id"])
    bt = _paid(kas, kind="out", purpose="Xarajat", amount="200", account=bank)
    rko = _paid(kas, kind="out", purpose="Xarajat", amount="300")
    bk = _paid(kas, kind="in", purpose="Boshqa kirim", amount="400", account=bank)
    ot = _paid(kas, kind="transfer", amount="500", to_account_id=bank)
    pko2 = _paid(kas, kind="in", purpose="Boshqa kirim", amount="600")
    assert [o["code"] for o in (pko, bt, rko, bk, ot, pko2)] == ["PKO-00001", "BT-00001", "RKO-00001", "BK-00001",
                                                                 "OT-00001", "PKO-00002"]
    assert pko["status"] == "posted" and pko["entry_code"] == "BX-00003" and pko["allowed_statuses"] == ["cancelled"]
    # a posted order is immutable; posting twice is a conflict; a draft can be deleted, a posted one not
    assert kas.patch(f"{K}/orders/{pko['id']}/", {"amount": "999"}, format="json").status_code == 409
    _post(kas, pko["id"], expect=409)
    assert kas.delete(f"{K}/orders/{pko['id']}/").status_code == 409
    d2 = _order(kas, kind="in", purpose="Boshqa kirim", amount="1")
    assert kas.patch(f"{K}/orders/{d2['id']}/", {"amount": "2", "basis": "x"}, format="json").status_code == 200
    assert kas.delete(f"{K}/orders/{d2['id']}/").status_code == 204
    # the list filters by account (transfers show on both), kind, status
    assert kas.get(f"{K}/orders/", {"account": bank}).json()["total"] == 3
    assert kas.get(f"{K}/orders/", {"kind": "transfer"}).json()["total"] == 1
    assert kas.get(f"{K}/orders/", {"status": "draft"}).json()["total"] == 0
    history = kas.get(f"{API}/chatter/", {"model": "kassa.cashorder", "res_id": pko["id"]}).json()
    assert any(m["changes"] and m["changes"][0]["new"] == "O'tkazilgan" for m in history)


def test_purpose_needs_partner_employee_and_matching_direction(kas):
    _fund(kas, "5000000")
    o = _order(kas, kind="out", purpose="Yetkazib beruvchiga to'lov", amount="100")
    r = kas.post(f"{K}/orders/{o['id']}/post/", {}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "partner"
    o = _order(kas, kind="out", purpose="Ish haqi", amount="100")
    r = kas.post(f"{K}/orders/{o['id']}/post/", {}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "employee"
    r = kas.post(f"{K}/orders/", {"kind": "in", "amount": "1", "account_id": kassa_id(), "purpose_id": purpose_id("Xarajat")},
                 format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "purpose_id"
    o = _order(kas, kind="out", amount="100")  # no purpose at all
    assert kas.post(f"{K}/orders/{o['id']}/post/", {}, format="json").json()["error"]["field"] == "purpose_id"
    r = kas.post(f"{K}/orders/", {"kind": "transfer", "amount": "100", "account_id": kassa_id()}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "to_account_id"  # no target
    assert kas.post(f"{K}/orders/", {"kind": "in", "amount": "0", "account_id": kassa_id()}, format="json").status_code == 400


# ---------------------------------------------------------------- customer postings


def test_client_pays_an_advance(kas):
    c = _client(kas)
    p = _project(kas, c["id"])
    o = _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="5000000", partner_id=c["id"], project_id=p["id"])
    assert _entry_lines(kas, o["entry_id"]) == {("5010", D("5000000"), D(0)), ("6310", D(0), D("5000000"))}
    e = kas.get(f"{ACC}/entries/{o['entry_id']}/").json()
    adv = next(ln for ln in e["lines"] if ln["account"]["code"] == "6310")
    assert adv["partner"]["id"] == c["id"] and adv["project"]["id"] == p["id"]
    assert e["source_model"] == "kassa.cashorder" and e["source_id"] == o["id"]
    assert e["source_label"] == f"Kassa orderi {o['code']}"
    bal = kas.get(f"{ACC}/balances/partner/{c['id']}/").json()
    assert D(bal["advance_received"]) == D("5000000")


def test_client_pays_after_the_invoice_splits_ar_and_advance(kas):
    c = _client(kas)
    p = _project(kas, c["id"])
    _invoice(kas, kind="customer", partner_id=c["id"], project_id=p["id"],
             lines=[{"name": "Deraza", "qty": "1", "price": "6200000"}])
    assert D(kas.get(f"{ACC}/balances/partner/{c['id']}/").json()["ar"]) == D("6200000")
    o = _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="8000000", partner_id=c["id"], project_id=p["id"])
    assert _entry_lines(kas, o["entry_id"]) == {
        ("5010", D("8000000"), D(0)), ("4010", D(0), D("6200000")), ("6310", D(0), D("1800000"))}
    bal = kas.get(f"{ACC}/balances/partner/{c['id']}/").json()
    assert D(bal["ar"]) == 0 and D(bal["advance_received"]) == D("1800000")
    money = kas.get(f"{API}/projects/{p['id']}/").json()["money"]
    assert (D(money["invoiced"]), D(money["paid"]), D(money["debt"])) == (D("6200000"), D("8000000"), D("-1800000"))


def test_invoice_cap_limits_the_ar_part(kas):
    c = _client(kas)
    a = _invoice(kas, kind="customer", partner_id=c["id"], lines=[{"name": "A", "qty": "1", "price": "3000000"}])
    _invoice(kas, kind="customer", partner_id=c["id"], lines=[{"name": "B", "qty": "1", "price": "4000000"}])
    # 5 000 000 "for HF-00001" (3 000 000 open): 3 000 000 closes AR, the rest is an advance — not AR of B
    o = _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="5000000", partner_id=c["id"], invoice_id=a["id"])
    assert _entry_lines(kas, o["entry_id"]) == {
        ("5010", D("5000000"), D(0)), ("4010", D(0), D("3000000")), ("6310", D(0), D("2000000"))}
    assert o["invoice"]["code"] == a["code"]
    # the invoice is now fully paid: another payment for it is all advance
    o2 = _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="100000", partner_id=c["id"], invoice_id=a["id"])
    assert _entry_lines(kas, o2["entry_id"]) == {("5010", D("100000"), D(0)), ("6310", D(0), D("100000"))}
    assert kas.get(f"{K}/orders/", {"invoice": a["id"]}).json()["total"] == 2
    # an invoice of another partner is refused
    other = _client(kas, "Boshqa")
    r = kas.post(f"{K}/orders/", {"kind": "in", "amount": "1", "account_id": kassa_id(), "partner_id": other["id"],
                                  "invoice_id": a["id"], "purpose_id": purpose_id("Mijozdan to'lov")}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "invoice_id"


def test_refund_to_client_takes_the_advance_first(kas):
    _fund(kas, "1000000")
    c = _client(kas)
    _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="2000000", partner_id=c["id"])
    o = _paid(kas, kind="out", purpose="Mijozga qaytarish", amount="2500000", partner_id=c["id"])
    assert o["code"] == "RKO-00001"
    assert _entry_lines(kas, o["entry_id"]) == {
        ("6310", D("2000000"), D(0)), ("4010", D("500000"), D(0)), ("5010", D(0), D("2500000"))}
    bal = kas.get(f"{ACC}/balances/partner/{c['id']}/").json()
    assert D(bal["advance_received"]) == 0 and D(bal["ar"]) == D("500000")


# ---------------------------------------------------------------- supplier postings


def test_prepayment_to_supplier_from_the_bank(kas):
    _fund(kas, "20000000", "5110")
    s = _client(kas, "AKFA")
    o = _paid(kas, kind="out", purpose="Yetkazib beruvchiga to'lov", amount="10000000", partner_id=s["id"],
              account=kassa_id("Hisob raqami"))
    assert o["code"] == "BT-00001"
    assert _entry_lines(kas, o["entry_id"]) == {("4310", D("10000000"), D(0)), ("5110", D(0), D("10000000"))}
    assert D(kas.get(f"{ACC}/balances/partner/{s['id']}/").json()["advance_paid"]) == D("10000000")


def test_paying_the_rest_closes_the_payable(kas):
    _fund(kas, "20000000", "5110")
    s = _client(kas, "AKFA")
    _invoice(kas, kind="supplier", partner_id=s["id"],
             lines=[{"name": "Profil", "qty": "1", "price": "16880000", "role": "materials"}])
    o = _paid(kas, kind="out", purpose="Yetkazib beruvchiga to'lov", amount="16880000", partner_id=s["id"],
              account=kassa_id("Hisob raqami"))
    assert _entry_lines(kas, o["entry_id"]) == {("6010", D("16880000"), D(0)), ("5110", D(0), D("16880000"))}
    bal = kas.get(f"{ACC}/balances/partner/{s['id']}/").json()
    assert D(bal["ap"]) == 0 and D(bal["net_uzs"]) == 0
    # paying more than owed: the payable closes, the rest is a prepayment
    _invoice(kas, kind="supplier", partner_id=s["id"], lines=[{"name": "x", "qty": "1", "price": "1000000", "role": "materials"}])
    o2 = _paid(kas, kind="out", purpose="Yetkazib beruvchiga to'lov", amount="1500000", partner_id=s["id"],
               account=kassa_id("Hisob raqami"))
    assert _entry_lines(kas, o2["entry_id"]) == {
        ("6010", D("1000000"), D(0)), ("4310", D("500000"), D(0)), ("5110", D(0), D("1500000"))}
    # refund from the supplier returns the prepayment first
    o3 = _paid(kas, kind="in", purpose="Yetkazib beruvchidan qaytarish", amount="700000", partner_id=s["id"],
               account=kassa_id("Hisob raqami"))
    assert _entry_lines(kas, o3["entry_id"]) == {
        ("5110", D("700000"), D(0)), ("4310", D(0), D("500000")), ("6010", D(0), D("200000"))}


# ---------------------------------------------------------------- account purposes, transfer, USD


def test_every_account_purpose_posts_its_role(kas):
    _fund(kas, "50000000")
    emp = _employee(kas)
    cases = [
        ("Ish haqi", "out", "6710", {"employee_id": emp["id"]}),
        ("Xodimga avans", "out", "4220", {"employee_id": emp["id"]}),
        ("Avans qaytarildi", "in", "4220", {"employee_id": emp["id"]}),
        ("Xarajat", "out", "9420", {}),
        ("Ta'sischidan qarz", "in", "6820", {}),
        ("Ta'sischiga qaytarish", "out", "6820", {}),
        ("Bank xizmati", "out", "9430", {}),
        ("Soliq to'lovi", "out", "6410", {}),
        ("Boshqa kirim", "in", "9390", {}),
        ("Boshqa chiqim", "out", "9430", {}),
    ]
    for name, kind, code, extra in cases:
        o = _paid(kas, kind=kind, purpose=name, amount="3000000", **extra)
        expected = ({(code, D("3000000"), D(0)), ("5010", D(0), D("3000000"))} if kind == "out"
                    else {("5010", D("3000000"), D(0)), (code, D(0), D("3000000"))})
        assert _entry_lines(kas, o["entry_id"]) == expected, name
    # "Xarajat" with the role changed on the order goes to 9410
    o = _paid(kas, kind="out", purpose="Xarajat", amount="100", account_role="selling_expense")
    assert ("9410", D("100"), D(0)) in _entry_lines(kas, o["entry_id"])


def test_transfer_to_the_bank_moves_both_balances(kas):
    _fund(kas, "25000000")
    bank = kassa_id("Hisob raqami")
    o = _paid(kas, kind="transfer", amount="20000000", to_account_id=bank)
    assert o["code"] == "OT-00001" and o["purpose"] is None
    assert _entry_lines(kas, o["entry_id"]) == {("5110", D("20000000"), D(0)), ("5010", D(0), D("20000000"))}
    assert _balance(kas) == D("5000000") and _balance(kas, "Hisob raqami") == D("20000000")
    # to the same account, or more than the kassa holds: refused
    r = kas.post(f"{K}/orders/", {"kind": "transfer", "amount": "1", "account_id": kassa_id(), "to_account_id": kassa_id()},
                 format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "to_account_id"
    o2 = _order(kas, kind="transfer", amount="6000000", to_account_id=bank)
    assert kas.post(f"{K}/orders/{o2['id']}/post/", {}, format="json").status_code == 409


def test_dollar_kassa_posts_at_the_rate(kas):
    usd = kassa_id("Valyuta kassasi")
    c = _client(kas)
    o = _order(kas, kind="in", purpose="Mijozdan to'lov", amount="1000", account=usd, partner_id=c["id"], date="2026-10-12")
    r = kas.post(f"{K}/orders/{o['id']}/post/", {}, format="json")
    assert r.status_code == 409 and "Kurs kiritilmagan" in r.json()["error"]["message"]
    assert kas.post(f"{ACC}/rates/", {"date": "2026-10-12", "currency": "USD", "rate": "12000"}, format="json").status_code == 201
    o = _post(kas, o["id"])
    assert o["currency"] == "USD" and D(o["rate"]) == D("12000") and D(o["amount_uzs"]) == D("12000000")
    assert _entry_lines(kas, o["entry_id"]) == {("5020", D("12000000"), D(0)), ("6310", D(0), D("12000000"))}
    e = kas.get(f"{ACC}/entries/{o['entry_id']}/").json()
    cash = next(ln for ln in e["lines"] if ln["account"]["code"] == "5020")
    assert (cash["currency"], D(cash["amount_cur"]), D(cash["rate"])) == ("USD", D("1000"), D("12000"))
    acc = next(a for a in kas.get(f"{K}/accounts/").json() if a["id"] == usd)
    assert (D(acc["balance"]), D(acc["balance_uzs"])) == (D("1000"), D("12000000"))
    # a chiqim with its own rate: 400 USD at 12 100 → Kt 5020 4 840 000
    o2 = _paid(kas, kind="out", purpose="Xarajat", amount="400", account=usd, date="2026-10-12", rate="12100")
    assert ("5020", D(0), D("4840000")) in _entry_lines(kas, o2["entry_id"])
    assert D(next(a for a in kas.get(f"{K}/accounts/").json() if a["id"] == usd)["balance"]) == D("600")
    # overdraft is checked in USD
    o3 = _order(kas, kind="out", purpose="Xarajat", amount="601", account=usd, date="2026-10-12")
    r = kas.post(f"{K}/orders/{o3['id']}/post/", {}, format="json")
    assert r.status_code == 409 and "600 USD" in r.json()["error"]["message"]
    # the USD advance is applied to a USD invoice later (accounting's own rule, through the same partner lines)
    inv = _invoice(kas, kind="customer", partner_id=c["id"], date="2026-10-12", currency="USD",
                   lines=[{"name": "Deraza", "qty": "1", "price": "1000"}])
    assert ("6310", D("12000000"), D(0)) in _entry_lines(kas, inv["entry_id"])


# ---------------------------------------------------------------- overdraft and cancel


def test_not_enough_cash_is_409_with_the_balance(kas):
    _fund(kas, "1250000")
    o = _order(kas, kind="out", purpose="Xarajat", amount="2000000")
    r = kas.post(f"{K}/orders/{o['id']}/post/", {}, format="json")
    assert r.status_code == 409
    assert r.json()["error"]["message"] == "Kassada mablag' yetarli emas: qoldiq 1 250 000"
    assert kas.get(f"{K}/orders/{o['id']}/").json()["status"] == "draft"  # nothing was written
    assert ledger.account_balance("cash_uzs") == D("1250000")


def test_cancel_reverses_and_a_spent_kirim_cannot_be_cancelled(kas):
    c = _client(kas)
    p = _project(kas, c["id"])
    o = _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="5000000", partner_id=c["id"], project_id=p["id"])
    assert kas.post(f"{K}/orders/{o['id']}/cancel/", {}, format="json").status_code == 400  # reason required
    r = kas.post(f"{K}/orders/{o['id']}/cancel/", {"comment": "Noto'g'ri summa"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert kas.get(f"{ACC}/entries/{o['entry_id']}/").json()["status"] == "reversed"
    assert _balance(kas) == 0 and D(kas.get(f"{ACC}/balances/partner/{c['id']}/").json()["advance_received"]) == 0
    assert kas.post(f"{K}/orders/{o['id']}/cancel/", {"comment": "x"}, format="json").status_code == 409
    history = kas.get(f"{API}/chatter/", {"model": "kassa.cashorder", "res_id": o["id"]}).json()
    assert history[0]["body"] == "Bekor qilindi: Noto'g'ri summa"
    # kirim 5 000 000, then 4 000 000 spent: the kassa holds 1 000 000, the kirim cannot be reversed
    o2 = _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="5000000", partner_id=c["id"])
    _paid(kas, kind="out", purpose="Xarajat", amount="4000000")
    r = kas.post(f"{K}/orders/{o2['id']}/cancel/", {"comment": "x"}, format="json")
    assert r.status_code == 409 and "qoldiq 1 000 000" in r.json()["error"]["message"]
    # a draft is not cancelled, it is deleted
    d = _order(kas, kind="in", purpose="Boshqa kirim", amount="1")
    assert kas.post(f"{K}/orders/{d['id']}/cancel/", {"comment": "x"}, format="json").status_code == 409


def test_lock_date_applies_to_posting_and_cancel(kas):
    _fund(kas, "1000000", date="2026-09-01")
    o = _paid(kas, kind="out", purpose="Xarajat", amount="100", date="2026-09-15")
    assert kas.patch(f"{API}/company/", {"lock_date": "2026-09-30"}, format="json").status_code == 200
    d = _order(kas, kind="out", purpose="Xarajat", amount="100", date="2026-09-20")
    r = kas.post(f"{K}/orders/{d['id']}/post/", {}, format="json")
    assert r.status_code == 409 and "Davr yopilgan" in r.json()["error"]["message"]
    assert kas.post(f"{K}/orders/{o['id']}/cancel/", {"comment": "x"}, format="json").status_code == 409
    assert kas.post(f"{K}/orders/{o['id']}/cancel/", {"comment": "x", "date": "2026-10-01"}, format="json").status_code == 200


# ---------------------------------------------------------------- cash book


def test_cash_book_day_totals(kas):
    _fund(kas, "3000000", date="2026-10-09")
    c = _client(kas)
    _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="5000000", partner_id=c["id"], date="2026-10-10")
    _paid(kas, kind="out", purpose="Xarajat", amount="1200000", date="2026-10-10", basis="Transport")
    _paid(kas, kind="out", purpose="Xarajat", amount="100", date="2026-10-11")  # the next day: not in this book
    book = kas.get(f"{K}/book/", {"account": kassa_id(), "date": "2026-10-10"}).json()
    assert (D(book["opening"]), D(book["total_in"]), D(book["total_out"]), D(book["closing"])) == (
        D("3000000"), D("5000000"), D("1200000"), D("6800000"))
    assert [(r["code"], D(r["in"]), D(r["out"])) for r in book["rows"]] == [
        ("PKO-00001", D("5000000"), 0), ("RKO-00001", 0, D("1200000"))]
    assert book["rows"][0]["partner"]["name"] == c["name"] and book["rows"][1]["basis"] == "Transport"
    assert D(book["other"]) == 0 and book["over_limit"] is False
    # the limit is a warning only
    kas.patch(f"{K}/accounts/{kassa_id()}/", {"cash_limit": "5000000"}, format="json")
    assert kas.get(f"{K}/book/", {"account": kassa_id(), "date": "2026-10-10"}).json()["over_limit"] is True
    # the opening-balance entry is a movement that is not an order: it shows as `other` on its day
    day0 = kas.get(f"{K}/book/", {"account": kassa_id(), "date": "2026-10-09"}).json()
    assert D(day0["opening"]) == 0 and D(day0["other"]) == D("3000000") and D(day0["closing"]) == D("3000000")
    assert kas.get(f"{K}/book/", {"account": kassa_id()}).status_code == 400


# ---------------------------------------------------------------- Loyiha


def test_project_advance_is_derived_from_payments(kas):
    c = _client(kas)
    p = _project(kas, c["id"], amount="10000000", service_amount="1500000", advance_amount="4000000")
    assert p["debt_amount"] == "7500000.00" and p["advance_derived"] is False
    detail = kas.get(f"{API}/projects/{p['id']}/").json()
    assert detail["payments"] == {"count": "0", "paid": "0", "last_date": None}
    # before any payment the advance is typed
    assert kas.patch(f"{API}/projects/{p['id']}/", {"advance_amount": "4500000"}, format="json").json()["advance_amount"] == "4500000.00"
    a = _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="3000000", partner_id=c["id"], project_id=p["id"], date="2026-10-03")
    _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="1000000", partner_id=c["id"], project_id=p["id"], date="2026-10-07")
    detail = kas.get(f"{API}/projects/{p['id']}/").json()
    assert detail["advance_amount"] == "4000000.00" and detail["advance_date"] == "2026-10-03"
    assert detail["advance_derived"] is True and detail["debt_amount"] == "7500000.00"
    assert detail["payments"] == {"count": "2", "paid": "4000000.00", "last_date": "2026-10-07"}
    # sent values are ignored while payments exist
    r = kas.patch(f"{API}/projects/{p['id']}/", {"advance_amount": "9000000", "advance_date": "2026-01-01"}, format="json")
    assert r.status_code == 200 and r.json()["advance_amount"] == "4000000.00" and r.json()["advance_date"] == "2026-10-03"
    # the Loyiha history shows the payment and the advance change
    history = kas.get(f"{API}/chatter/", {"model": "projects.project", "res_id": p["id"]}).json()
    assert any(m["body"].startswith(f"To'lov {a['code']}") for m in history)
    assert any(m["changes"] and m["changes"][0]["field"] == "advance_amount" for m in history)
    # cancelling the first payment moves the advance and its date
    kas.post(f"{K}/orders/{a['id']}/cancel/", {"comment": "xato"}, format="json")
    detail = kas.get(f"{API}/projects/{p['id']}/").json()
    assert detail["advance_amount"] == "1000000.00" and detail["advance_date"] == "2026-10-07"
    # a refund reduces it; the Loyiha's payments list is filterable
    _paid(kas, kind="out", purpose="Mijozga qaytarish", amount="250000", partner_id=c["id"], project_id=p["id"], date="2026-10-08")
    assert kas.get(f"{API}/projects/{p['id']}/").json()["advance_amount"] == "750000.00"
    assert kas.get(f"{K}/orders/", {"project": p["id"], "status": "posted"}).json()["total"] == 2


def test_project_in_usd_converts_payments_at_the_order_rate(kas):
    c = _client(kas)
    p = _project(kas, c["id"], amount="1000", currency="USD", usd_rate="12500")
    usd = kassa_id("Valyuta kassasi")
    _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="300", account=usd, partner_id=c["id"], project_id=p["id"],
          date="2026-10-12", rate="12000")
    _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="2500000", partner_id=c["id"], project_id=p["id"], date="2026-10-13")
    detail = kas.get(f"{API}/projects/{p['id']}/").json()
    assert detail["advance_amount"] == "500.00"  # 300 USD + 2 500 000 / 12 500 (the contract's rate)
    # a so'm Loyiha with a USD payment: 300 × 12 000
    p2 = _project(kas, c["id"], amount="5000000")
    _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="300", account=usd, partner_id=c["id"], project_id=p2["id"],
          date="2026-10-12", rate="12000")
    assert kas.get(f"{API}/projects/{p2['id']}/").json()["advance_amount"] == "3600000.00"


def test_order_from_project_takes_the_client(kas):
    c = _client(kas)
    p = _project(kas, c["id"])
    o = _order(kas, kind="in", purpose="Mijozdan to'lov", amount="100", project_id=p["id"])
    assert o["partner"]["id"] == c["id"] and o["project"]["id"] == p["id"]


# ---------------------------------------------------------------- purposes CRUD


def test_purposes_crud(kas):
    r = kas.post(f"{K}/purposes/", {"name": "Ijara", "direction": "out", "posting": "account", "account_role": "admin_expense"},
                 format="json")
    assert r.status_code == 201, r.content
    pid = r.json()["id"]
    bad = kas.post(f"{K}/purposes/", {"name": "Yo'q rol", "direction": "out", "posting": "account", "account_role": "nope"},
                   format="json")
    assert bad.status_code == 409
    bad = kas.post(f"{K}/purposes/", {"name": "Rolsiz", "direction": "out", "posting": "account"}, format="json")
    assert bad.status_code == 400 and bad.json()["error"]["field"] == "account_role"
    assert kas.patch(f"{K}/purposes/{pid}/", {"name": "Ofis ijarasi"}, format="json").status_code == 200
    _fund(kas, "1000")
    _paid(kas, kind="out", purpose="Ofis ijarasi", amount="10")
    assert kas.delete(f"{K}/purposes/{pid}/").status_code == 409  # used: deactivate instead
    assert kas.patch(f"{K}/purposes/{pid}/", {"is_active": False}, format="json").json()["is_active"] is False
    o = _order(kas, kind="out", purpose="Ofis ijarasi", amount="10")
    assert kas.post(f"{K}/orders/{o['id']}/post/", {}, format="json").status_code == 400
    r = kas.post(f"{K}/purposes/", {"name": "Vaqtincha", "direction": "in", "posting": "account", "account_role": "other_op_income"},
                 format="json")
    assert kas.delete(f"{K}/purposes/{r.json()['id']}/").status_code == 204
    assert len(kas.get(f"{K}/purposes/", {"direction": "in"}).json()) == 5


# ---------------------------------------------------------------- access


def test_permissions(api, kas):
    _fund(kas, "1000000")
    c = _client(kas)
    p = _project(kas, c["id"])
    manager = _user_with(api, kas, "manager1", {"projects": ["view", "update"], "clients": ["view"]})
    assert manager.get(f"{K}/orders/").status_code == 403
    assert manager.get(f"{K}/accounts/").status_code == 403
    assert manager.get(f"{K}/book/", {"account": kassa_id(), "date": "2026-10-10"}).status_code == 403
    assert manager.get(f"{K}/summary/").status_code == 403
    assert "payments" in manager.get(f"{API}/projects/{p['id']}/").json()  # read-only on the card
    viewer = _user_with(api, kas, "viewer1", {"cash_orders": ["view", "create"], "kassa": ["view"], "cash_book": ["view"]})
    assert viewer.get(f"{K}/orders/").status_code == 200
    assert viewer.get(f"{K}/purposes/").status_code == 200  # the form lists them
    assert viewer.post(f"{K}/purposes/", {"name": "x", "posting": "account", "account_role": "payroll"}, format="json").status_code == 403
    assert viewer.get(f"{K}/book/", {"account": kassa_id(), "date": "2026-10-10"}).status_code == 200
    assert viewer.get(f"{K}/summary/").status_code == 200
    assert viewer.post(f"{K}/accounts/", {"name": "x"}, format="json").status_code == 403
    r = viewer.post(f"{K}/orders/", {"kind": "out", "amount": "100", "account_id": kassa_id(), "purpose_id": purpose_id("Xarajat")},
                    format="json")
    assert r.status_code == 201
    assert viewer.post(f"{K}/orders/{r.json()['id']}/post/", {}, format="json").status_code == 403
    assert viewer.post(f"{K}/orders/{r.json()['id']}/cancel/", {"comment": "x"}, format="json").status_code == 403
    assert viewer.delete(f"{K}/orders/{r.json()['id']}/").status_code == 403
    kassir = _user_with(api, kas, "kassir1", {"cash_orders": ["view", "create", "update", "delete"]})
    assert kassir.post(f"{K}/orders/{r.json()['id']}/post/", {}, format="json").status_code == 200
    # seeded role
    roles = {r["name"] for r in kas.get(f"{API}/access/roles/").json()["items"]}
    assert "Kassir" in roles


def test_partner_balance_and_client_payments_listing(kas):
    c = _client(kas)
    _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="100", partner_id=c["id"])
    _paid(kas, kind="in", purpose="Mijozdan to'lov", amount="200", partner_id=c["id"])
    assert kas.get(f"{K}/orders/", {"partner": c["id"]}).json()["total"] == 2
    partner = Client.objects.get(pk=c["id"])
    from apps.kassa import selectors

    assert selectors.partner_payments(partner) == {"count": 2, "last_date": __import__("datetime").date(2026, 10, 10),
                                                   "paid_in": D("300"), "paid_out": 0}


# ---------------------------------------------------------------- money requests (ADR 0009)


def _ps(kas, partner_id, amount="10000000", submit=True, **extra):
    r = kas.post(f"{K}/payment-requests/", {"partner_id": partner_id, "amount": amount,
                                            "purpose_id": purpose_id("Yetkazib beruvchiga to'lov"), **extra},
                 format="json")
    assert r.status_code == 201, r.content
    ps = r.json()
    if submit:
        r = kas.post(f"{K}/payment-requests/{ps['id']}/submit/", {}, format="json")
        assert r.status_code == 200, r.content
        ps = r.json()
    return ps


def test_money_request_lifecycle_and_paid_in_one_go(kas):
    _fund(kas, "20000000")
    s = _client(kas, "AKFA")
    ps = _ps(kas, s["id"], basis="Profil uchun")
    assert ps["code"].startswith("PS-") and ps["status"] == "submitted" and ps["requested_by"]
    assert ps["allowed_statuses"] == ["approved", "cancelled", "rejected"]
    assert kas.get(f"{K}/summary/").json()["payment_requests"] == 1

    # a chiqim cannot be linked before kassa approves
    r = kas.post(f"{K}/orders/", {"kind": "out", "amount": "10000000", "account_id": kassa_id(),
                                  "purpose_id": purpose_id("Yetkazib beruvchiga to'lov"), "partner_id": s["id"],
                                  "payment_request_id": ps["id"]}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "payment_request"

    r = kas.post(f"{K}/payment-requests/{ps['id']}/reject/", {}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "comment"
    r = kas.post(f"{K}/payment-requests/{ps['id']}/approve/", {"comment": "OK"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "approved" and r.json()["decided_by"]
    assert kas.patch(f"{K}/payment-requests/{ps['id']}/", {"amount": "1"}, format="json").status_code == 409

    o = _paid(kas, kind="out", purpose="Yetkazib beruvchiga to'lov", amount="10000000", payment_request_id=ps["id"])
    assert o["partner"]["id"] == s["id"] and o["payment_request_code"] == ps["code"]
    ps = kas.get(f"{K}/payment-requests/{ps['id']}/").json()
    assert ps["status"] == "paid" and D(ps["paid"]) == D("10000000")
    assert [c["code"] for c in ps["cash_orders"]] == [o["code"]]
    r = kas.post(f"{K}/payment-requests/{ps['id']}/cancel/", {}, format="json")
    assert r.status_code == 409

    # cancelling the chiqim gives the request back to kassa
    r = kas.post(f"{K}/orders/{o['id']}/cancel/", {"comment": "Xato"}, format="json")
    assert r.status_code == 200, r.content
    ps = kas.get(f"{K}/payment-requests/{ps['id']}/").json()
    assert ps["status"] == "approved" and D(ps["paid"]) == 0
    r = kas.post(f"{K}/payment-requests/{ps['id']}/cancel/", {"comment": "Kerak emas"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    hist = kas.get(f"{API}/chatter/", {"model": "kassa.paymentrequest", "res_id": ps["id"]}).json()
    assert hist[0]["body"] == "Bekor qilindi: Kerak emas"


def test_money_request_paid_in_parts_and_rejected(kas):
    _fund(kas, "20000000")
    s = _client(kas, "AKFA")
    ps = _ps(kas, s["id"])
    kas.post(f"{K}/payment-requests/{ps['id']}/approve/", {}, format="json")
    _paid(kas, kind="out", purpose="Yetkazib beruvchiga to'lov", amount="4000000", partner_id=s["id"],
          payment_request_id=ps["id"])
    ps = kas.get(f"{K}/payment-requests/{ps['id']}/").json()
    assert ps["status"] == "approved" and D(ps["paid"]) == D("4000000")
    _paid(kas, kind="out", purpose="Yetkazib beruvchiga to'lov", amount="6000000", partner_id=s["id"],
          payment_request_id=ps["id"])
    assert kas.get(f"{K}/payment-requests/{ps['id']}/").json()["status"] == "paid"

    other = _ps(kas, s["id"], amount="5000000")
    r = kas.post(f"{K}/payment-requests/{other['id']}/reject/", {"comment": "Qimmat"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "rejected" and r.json()["decision_comment"] == "Qimmat"
    assert kas.get(f"{K}/payment-requests/", {"status": "rejected"}).json()["total"] == 1
    r = kas.post(f"{K}/orders/", {"kind": "out", "amount": "100", "account_id": kassa_id(),
                                  "purpose_id": purpose_id("Yetkazib beruvchiga to'lov"), "partner_id": s["id"],
                                  "payment_request_id": other["id"]}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "payment_request"


def test_money_request_permissions(api, kas):
    s = _client(kas, "AKFA")
    ps = _ps(kas, s["id"])
    buyer = _user_with(api, kas, "buyer1", {"payment_requests": ["view", "create", "update"]})
    assert buyer.get(f"{K}/payment-requests/").json()["total"] == 1
    assert buyer.post(f"{K}/payment-requests/{ps['id']}/approve/", {}, format="json").status_code == 403
    assert buyer.post(f"{K}/payment-requests/{ps['id']}/reject/", {"comment": "x"}, format="json").status_code == 403
    kassir = _user_with(api, kas, "kassir2", {"payment_approve": ["view", "update"]})
    assert kassir.post(f"{K}/payment-requests/{ps['id']}/approve/", {}, format="json").status_code == 200
    nobody = _user_with(api, kas, "nobody1", {"cash_orders": ["view"]})
    assert nobody.get(f"{K}/payment-requests/").status_code == 403
