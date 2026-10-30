"""add-accounting: every scenario of openspec/changes/add-accounting/specs/accounting/spec.md at API level."""

import datetime as dt
from decimal import Decimal

import httpx
import pytest
from django.core.management import call_command

from apps.accounting import selectors, services
from apps.accounting.models import Account, JournalEntry
from apps.users.models import User
from conftest import API, login

ACC = f"{API}/accounting"
D = Decimal


@pytest.fixture
def acc(admin):
    """Admin client with the chart of accounts seeded (the `seed` command does users and roles only)."""
    call_command("seed_accounting", verbosity=0)
    return admin


def account_id(code: str) -> int:
    return Account.objects.get(code=code).pk


def _client(acc, name="Mega Qurilish MChJ", **extra):
    r = acc.post(f"{API}/clients/", {"name": name, "kind": "company", **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _project(acc, client_id, amount="12960000", items=None, **extra):
    r = acc.post(f"{API}/projects/", {"name": "Uy derazalari", "client_id": client_id, "amount": amount,
                                       "items": items or [], **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _manual(acc, date, memo, lines, expect=201):
    r = acc.post(f"{ACC}/entries/", {"date": date, "memo": memo, "lines": lines}, format="json")
    assert r.status_code == expect, r.content
    return r.json()


def _line(code, *, debit=None, credit=None, **extra):
    row = {"account_id": account_id(code), **extra}
    if debit is not None:
        row["debit"] = str(debit)
    if credit is not None:
        row["credit"] = str(credit)
    return row


def _invoice(acc, *, kind, partner_id, lines, date="2026-10-15", **extra):
    r = acc.post(f"{ACC}/invoices/", {"kind": kind, "partner_id": partner_id, "date": date, "lines": lines, **extra},
                 format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _confirm(acc, inv_id, expect=200):
    r = acc.post(f"{ACC}/invoices/{inv_id}/confirm/", {}, format="json")
    assert r.status_code == expect, r.content
    return r.json()


def _entry_lines(acc, entry_id) -> set[tuple]:
    """{(account code, debit, credit)} of an entry — what the scenarios state."""
    e = acc.get(f"{ACC}/entries/{entry_id}/").json()
    return {(ln["account"]["code"], D(ln["debit"]), D(ln["credit"])) for ln in e["lines"]}


def _vat_on(acc, rate="12"):
    assert acc.patch(f"{API}/company/", {"vat_payer": True, "vat_rate": rate}, format="json").status_code == 200


def _user_with(api, admin, username, pages: dict[str, list[str]]):
    role = admin.post(f"{API}/access/roles/", {
        "name": f"Rol {username}",
        "permissions": [{"page_key": p, **{f"can_{a}": True for a in actions}} for p, actions in pages.items()],
    }, format="json").json()
    admin.post(f"{API}/users/", {"username": username, "first_name": "Test", "password": "password123",
                                 "role_ids": [role["id"]]}, format="json")
    return login(api, username, "password123")


# ---------------------------------------------------------------- journal


def test_unbalanced_entry_rejected_and_nothing_written(acc):
    r = acc.post(f"{ACC}/entries/", {"date": "2026-10-10", "memo": "x", "lines": [
        _line("1010", debit="100"), _line("6010", credit="90")]}, format="json")
    assert r.status_code == 400
    assert "O'tkazma balanslanmagan" in r.json()["error"]["message"]
    assert JournalEntry.objects.count() == 0


def test_manual_entry_posted_immutable_and_on_the_card(acc):
    e = _manual(acc, "2026-10-10", "Boshlang'ich qoldiq", [
        _line("5010", debit="1000000"), _line("8330", credit="1000000")])
    assert e["code"] == "BX-00001" and e["source_kind"] == "manual" and e["status"] == "posted"
    assert D(e["total_debit"]) == D("1000000")
    assert acc.patch(f"{ACC}/entries/{e['id']}/", {"memo": "y"}, format="json").status_code == 405
    assert acc.delete(f"{ACC}/entries/{e['id']}/").status_code == 405
    card = acc.get(f"{ACC}/reports/account-card/", {"account": account_id("5010"), "from": "2026-10-01",
                                                     "to": "2026-10-31"}).json()
    assert [r["entry"]["code"] for r in card["rows"]] == ["BX-00001"]
    assert D(card["closing"]) == D("1000000")
    # a line on a group account or without exactly one side is refused
    _manual(acc, "2026-10-10", "guruh", [_line("1000", debit="1"), _line("8330", credit="1")], expect=400)
    _manual(acc, "2026-10-10", "ikki tomon", [_line("1010", debit="1", credit="1"), _line("8330", credit="0")],
            expect=400)


def test_lock_date_blocks_posting_and_reversal(acc):
    e = _manual(acc, "2026-09-15", "sentabr", [_line("5010", debit="10"), _line("8330", credit="10")])
    assert acc.patch(f"{API}/company/", {"lock_date": "2026-09-30"}, format="json").status_code == 200
    r = acc.post(f"{ACC}/entries/", {"date": "2026-09-15", "memo": "kech", "lines": [
        _line("5010", debit="10"), _line("8330", credit="10")]}, format="json")
    assert r.status_code == 409 and "Davr yopilgan" in r.json()["error"]["message"]
    # reversing with the original (locked) date is refused, with a date in the open period it works
    assert acc.post(f"{ACC}/entries/{e['id']}/reverse/", {}, format="json").status_code == 409
    assert acc.post(f"{ACC}/entries/{e['id']}/reverse/", {"date": "2026-10-01"}, format="json").status_code == 201
    _manual(acc, "2026-10-01", "oktabr", [_line("5010", debit="10"), _line("8330", credit="10")])


def test_reversal_mirrors_and_cannot_repeat(acc):
    e = _manual(acc, "2026-10-10", "xato", [_line("1010", debit="500"), _line("6010", credit="500")])
    assert selectors.account_balance("materials") == D("500")
    r = acc.post(f"{ACC}/entries/{e['id']}/reverse/", {}, format="json")
    assert r.status_code == 201, r.content
    mirror = r.json()
    assert mirror["source_kind"] == "reversal" and mirror["memo"] == f"Storno {e['code']}"
    assert mirror["reversal_of_code"] == e["code"]
    assert _entry_lines(acc, mirror["id"]) == {("1010", D(0), D("500")), ("6010", D("500"), D(0))}
    original = acc.get(f"{ACC}/entries/{e['id']}/").json()
    assert original["status"] == "reversed" and original["reversed_by_code"] == mirror["code"]
    assert selectors.account_balance("materials") == 0 and selectors.account_balance("ap_suppliers") == 0
    assert acc.post(f"{ACC}/entries/{e['id']}/reverse/", {}, format="json").status_code == 409
    assert acc.post(f"{ACC}/entries/{mirror['id']}/reverse/", {}, format="json").status_code == 409
    # both show on the card (storno is visible), the card still closes at zero
    card = acc.get(f"{ACC}/reports/account-card/", {"account": account_id("1010")}).json()
    assert len(card["rows"]) == 2 and D(card["closing"]) == 0


# ---------------------------------------------------------------- invoices


def test_customer_invoice_vat_payer(acc):
    _vat_on(acc)
    c = _client(acc)
    p = _project(acc, c["id"])
    inv = _invoice(acc, kind="customer", partner_id=c["id"], project_id=p["id"],
                   lines=[{"name": "Deraza", "qty": "1", "price": "10000000"}])
    assert inv["code"] == "HF-00001" and inv["status"] == "draft"
    assert (D(inv["net"]), D(inv["vat"]), D(inv["gross"])) == (D("10000000"), D("1200000"), D("11200000"))
    inv = _confirm(acc, inv["id"])
    assert inv["status"] == "confirmed" and inv["entry_code"] == "BX-00001"
    assert _entry_lines(acc, inv["entry_id"]) == {
        ("4010", D("11200000"), D(0)), ("9010", D(0), D("10000000")), ("6410", D(0), D("1200000"))}
    e = acc.get(f"{ACC}/entries/{inv['entry_id']}/").json()
    ar = next(ln for ln in e["lines"] if ln["account"]["code"] == "4010")
    assert ar["partner"]["id"] == c["id"] and ar["project"]["id"] == p["id"]
    assert e["source_model"] == "accounting.invoice" and e["source_id"] == inv["id"]
    assert e["source_label"] == f"Hisob-faktura {inv['code']}"
    # confirmed: lines locked, confirm again → 409
    assert acc.patch(f"{ACC}/invoices/{inv['id']}/", {"notes": "x"}, format="json").status_code == 409
    _confirm(acc, inv["id"], expect=409)
    money = acc.get(f"{API}/projects/{p['id']}/").json()["money"]
    assert (D(money["invoiced"]), D(money["paid"]), D(money["debt"])) == (D("11200000"), 0, D("11200000"))
    history = acc.get(f"{API}/chatter/", {"model": "accounting.invoice", "res_id": inv["id"]}).json()
    assert any(m["changes"] and m["changes"][0]["new"] == "Tasdiqlangan" for m in history)


def test_customer_invoice_not_vat_payer(acc):
    c = _client(acc)
    inv = _invoice(acc, kind="customer", partner_id=c["id"],
                   lines=[{"name": "Deraza", "qty": "2", "price": "5000000", "vat_rate": "12"}])
    assert all(D(ln["vat_rate"]) == 0 for ln in inv["lines"]) and D(inv["vat"]) == 0
    inv = _confirm(acc, inv["id"])
    codes = {code for code, _, _ in _entry_lines(acc, inv["entry_id"])}
    assert codes == {"4010", "9010"}
    assert D(inv["gross"]) == D("10000000")


def test_customer_advance_offset(acc):
    _vat_on(acc)
    c = _client(acc)
    p = _project(acc, c["id"])
    # the client paid 5 000 000 in advance (what kassa will post): Dt 5010 Kt 6310 on the partner and Loyiha
    _manual(acc, "2026-10-05", "Avans", [
        _line("5010", debit="5000000"),
        _line("6310", credit="5000000", partner_id=c["id"], project_id=p["id"])])
    bal = acc.get(f"{ACC}/balances/partner/{c['id']}/").json()
    assert D(bal["advance_received"]) == D("5000000") and D(bal["net_uzs"]) == D("-5000000")
    inv = _invoice(acc, kind="customer", partner_id=c["id"], project_id=p["id"],
                   lines=[{"name": "Deraza", "qty": "1", "price": "10000000"}])
    inv = _confirm(acc, inv["id"])
    lines = _entry_lines(acc, inv["entry_id"])
    assert ("6310", D("5000000"), D(0)) in lines and ("4010", D(0), D("5000000")) in lines
    bal = acc.get(f"{ACC}/balances/partner/{c['id']}/").json()
    assert D(bal["ar"]) == D("6200000") and D(bal["advance_received"]) == 0 and D(bal["net_uzs"]) == D("6200000")
    money = acc.get(f"{ACC}/balances/project/{p['id']}/").json()
    assert (D(money["invoiced"]), D(money["paid"]), D(money["debt"])) == (D("11200000"), D("5000000"), D("6200000"))


def test_supplier_service_invoice(acc):
    _vat_on(acc)
    s = _client(acc, "AKFA")
    inv = _invoice(acc, kind="supplier", partner_id=s["id"],
                   lines=[{"name": "Yetkazib berish", "qty": "1", "price": "500000", "role": "admin_expense"}],
                   external_number="ESF-778", external_date="2026-10-14")
    inv = _confirm(acc, inv["id"])
    assert _entry_lines(acc, inv["entry_id"]) == {
        ("9420", D("500000"), D(0)), ("4410", D("60000"), D(0)), ("6010", D(0), D("560000"))}
    bal = acc.get(f"{ACC}/balances/partner/{s['id']}/").json()
    assert D(bal["ap"]) == D("560000") and D(bal["net_uzs"]) == D("-560000")


def test_supplier_advance_offset_and_reconciliation_act(acc):
    """AKFA pattern: prepay 10 000 000 → receipt 26 880 000 eats the prepayment → pay the rest 16 880 000."""
    s = _client(acc, "AKFA")
    _manual(acc, "2026-10-01", "Oldindan to'lov AKFA", [
        _line("4310", debit="10000000", partner_id=s["id"]), _line("5110", credit="10000000")])
    inv = _invoice(acc, kind="supplier", partner_id=s["id"], date="2026-10-10",
                   lines=[{"name": "Profil 70 mm", "unit": "m", "qty": "400", "price": "67200", "role": "materials"}])
    inv = _confirm(acc, inv["id"])
    lines = _entry_lines(acc, inv["entry_id"])
    assert ("1010", D("26880000"), D(0)) in lines and ("6010", D(0), D("26880000")) in lines
    assert ("6010", D("10000000"), D(0)) in lines and ("4310", D(0), D("10000000")) in lines
    from apps.clients.models import Client

    partner = Client.objects.get(pk=s["id"])
    pb = selectors.partner_balance(partner)
    assert (pb["ap"], pb["advance_paid"], pb["net_uzs"]) == (D("16880000"), 0, D("-16880000"))
    # the payment (what kassa will post) through the public contract
    actor = User.objects.get(username="admin")
    services.entry_post(actor=actor, date=dt.date(2026, 10, 20), memo="To'lov AKFA", lines=[
        *services.settle_lines(partner=partner, role="ap_suppliers", side="debit", amount_cur=D("16880000"),
                               currency="UZS"),
        {"role": "bank_uzs", "credit": D("16880000")},
    ])
    assert selectors.partner_balance(partner)["net_uzs"] == 0
    act = acc.get(f"{ACC}/reports/reconciliation/", {"partner": s["id"], "from": "2026-10-01", "to": "2026-10-31"}).json()
    assert D(act["opening"]) == 0 and D(act["closing"]) == 0
    assert [(r["document"], D(r["dt"]), D(r["kt"])) for r in act["rows"]] == [
        ("O'tkazma BX-00001", D("10000000"), 0),
        (f"Hisob-faktura {inv['code']}", 0, D("26880000")),
        ("O'tkazma BX-00003", D("16880000"), 0),
    ]
    assert D(act["turnover_dt"]) == D("26880000") == D(act["turnover_kt"])


def test_usd_invoice_needs_rate_then_posts_at_rate_and_fx_on_settlement(acc):
    from apps.clients.models import Client

    s = _client(acc, "AKFA")
    partner = Client.objects.get(pk=s["id"])
    inv = _invoice(acc, kind="supplier", partner_id=s["id"], date="2026-11-03", currency="USD",
                   lines=[{"name": "Profil", "qty": "1000", "price": "1", "role": "materials"}])
    r = acc.post(f"{ACC}/invoices/{inv['id']}/confirm/", {}, format="json")
    assert r.status_code == 409 and "Kurs kiritilmagan" in r.json()["error"]["message"]
    assert acc.post(f"{ACC}/rates/", {"date": "2026-11-03", "currency": "USD", "rate": "12000"}, format="json").status_code == 201
    inv = _confirm(acc, inv["id"])
    assert D(inv["rate"]) == D("12000")
    e = acc.get(f"{ACC}/entries/{inv['entry_id']}/").json()
    ap = next(ln for ln in e["lines"] if ln["account"]["code"] == "6010")
    assert (D(ap["credit"]), ap["currency"], D(ap["amount_cur"]), D(ap["rate"])) == (D("12000000"), "USD", D("1000"), D("12000"))
    pb = selectors.partner_balance(partner)
    assert pb["ap"] == D("12000000") and pb["net_cur"] == {"USD": D("-1000")}
    # paid in full at 12 100: Dt 6010 12 000 000 · Dt 9620 100 000 · Kt 5110 12 100 000
    actor = User.objects.get(username="admin")
    pay = services.entry_post(actor=actor, date=dt.date(2026, 11, 10), memo="To'lov", lines=[
        *services.settle_lines(partner=partner, role="ap_suppliers", side="debit", amount_cur=D("1000"),
                               currency="USD", rate=D("12100")),
        {"role": "bank_uzs", "credit": D("12100000")},
    ])
    assert _entry_lines(acc, pay.pk) == {
        ("6010", D("12000000"), D(0)), ("9620", D("100000"), D(0)), ("5110", D(0), D("12100000"))}
    pb = selectors.partner_balance(partner)
    assert pb["ap"] == 0 and pb["net_uzs"] == 0 and pb["net_cur"] == {}
    assert selectors.account_balance_cur("ap_suppliers", currency="USD", partner=partner) == 0


def test_usd_advance_offset_carries_fx_difference(acc):
    """Prepaid 500 USD at 12 000; a 1 000 USD invoice at 12 100 eats it: Kt 4310 at the old rate, the 50 000
    difference is a gain on 9540, and the supplier's USD and UZS balances agree."""
    from apps.clients.models import Client

    s = _client(acc, "AKFA")
    partner = Client.objects.get(pk=s["id"])
    actor = User.objects.get(username="admin")
    services.entry_post(actor=actor, date=dt.date(2026, 11, 1), memo="Avans USD", lines=[
        {"role": "advance_paid", "debit": D("6000000"), "partner": partner, "currency": "USD",
         "amount_cur": D("500"), "rate": D("12000")},
        {"role": "bank_uzs", "credit": D("6000000")},
    ])
    inv = _invoice(acc, kind="supplier", partner_id=s["id"], date="2026-11-03", currency="USD", rate="12100",
                   lines=[{"name": "Profil", "qty": "1000", "price": "1", "role": "materials"}])
    inv = _confirm(acc, inv["id"])
    lines = _entry_lines(acc, inv["entry_id"])
    assert ("6010", D("6050000"), D(0)) in lines and ("4310", D(0), D("6000000")) in lines
    assert ("9540", D(0), D("50000")) in lines
    pb = selectors.partner_balance(partner)
    assert pb["advance_paid"] == 0 and pb["ap"] == D("6050000") and pb["net_cur"] == {"USD": D("-500")}


def test_cancel_confirmed_invoice_reverses_entry(acc):
    _vat_on(acc)
    c = _client(acc)
    inv = _invoice(acc, kind="customer", partner_id=c["id"], lines=[{"name": "Deraza", "qty": "1", "price": "1000000"}])
    assert acc.post(f"{ACC}/invoices/{inv['id']}/cancel/", {}, format="json").status_code == 409  # draft: delete it
    inv = _confirm(acc, inv["id"])
    assert selectors.account_balance("ar_customers") == D("1120000")
    r = acc.post(f"{ACC}/invoices/{inv['id']}/cancel/", {}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert acc.get(f"{ACC}/entries/{inv['entry_id']}/").json()["status"] == "reversed"
    assert selectors.account_balance("ar_customers") == 0 and selectors.account_balance("vat_output") == 0
    assert acc.post(f"{ACC}/invoices/{inv['id']}/cancel/", {}, format="json").status_code == 409
    # a draft is deleted, a confirmed one is not
    draft = _invoice(acc, kind="customer", partner_id=c["id"], lines=[{"name": "x", "qty": "1", "price": "1"}])
    assert acc.delete(f"{ACC}/invoices/{draft['id']}/").status_code == 204
    assert acc.delete(f"{ACC}/invoices/{inv['id']}/").status_code == 409


def test_invoice_from_project_drafts_lines(acc):
    def ref(kind, name):
        return next(i["id"] for i in acc.get(f"{API}/references/", {"kind": kind, "size": 100}).json()["items"]
                    if i["name"] == name)

    c = _client(acc)
    p = _project(acc, c["id"], amount="12960000", items=[
        {"product_type_id": ref("product_type", "Termo"), "area_m2": "12.5", "quantity": 4},
        {"product_type_id": ref("product_type", "PVX"), "area_m2": "8", "quantity": 3},
    ])
    r = acc.post(f"{API}/projects/{p['id']}/invoice/", {}, format="json")
    assert r.status_code == 201, r.content
    inv = r.json()
    assert inv["kind"] == "customer" and inv["status"] == "draft" and inv["partner"]["id"] == c["id"]
    assert inv["project"]["id"] == p["id"] and len(inv["lines"]) == 2
    assert [ln["name"] for ln in inv["lines"]] == ["Termo 12.5 m² × 4", "PVX 8 m² × 3"]
    assert D(inv["gross"]) == D("12960000")
    listed = acc.get(f"{ACC}/invoices/", {"project": p["id"]}).json()
    assert listed["total"] == 1
    assert "Hisob-faktura yaratildi" in acc.get(f"{API}/chatter/", {"model": "projects.project", "res_id": p["id"]}).json()[0]["body"]
    # no lines → one line at the order amount
    p2 = _project(acc, c["id"], amount="1500000")
    inv2 = acc.post(f"{API}/projects/{p2['id']}/invoice/", {}, format="json").json()
    assert len(inv2["lines"]) == 1 and D(inv2["gross"]) == D("1500000")


def test_project_money_zero_without_postings(acc):
    c = _client(acc)
    p = _project(acc, c["id"], advance_amount="4000000")
    detail = acc.get(f"{API}/projects/{p['id']}/").json()
    m = detail["money"]
    assert {k: D(m[k]) for k in ("invoiced", "paid", "debt")} == {"invoiced": 0, "paid": 0, "debt": 0}
    assert m["currency"] == "UZS" and "debt_cur" not in m
    assert detail["debt_amount"] == "8960000.00"  # the typed amounts still show


# ---------------------------------------------------------------- reports


def test_trial_balance_balances(acc):
    _vat_on(acc)
    c = _client(acc)
    _manual(acc, "2026-09-20", "Boshlang'ich", [_line("5010", debit="3000000"), _line("8330", credit="3000000")])
    inv = _invoice(acc, kind="customer", partner_id=c["id"], date="2026-10-15",
                   lines=[{"name": "Deraza", "qty": "1", "price": "10000000"}])
    _confirm(acc, inv["id"])
    tb = acc.get(f"{ACC}/reports/trial-balance/", {"from": "2026-10-01", "to": "2026-10-31"}).json()
    t = tb["totals"]
    assert D(t["open_dt"]) == D(t["open_kt"]) == D("3000000")
    assert D(t["dt"]) == D(t["kt"]) == D("11200000")
    assert D(t["close_dt"]) == D(t["close_kt"]) == D("14200000")
    rows = {r["account"]["code"]: r for r in tb["rows"]}
    assert D(rows["5010"]["open_dt"]) == D("3000000") and D(rows["4010"]["close_dt"]) == D("11200000")
    assert D(rows["6410"]["close_kt"]) == D("1200000")


def test_rates_crud_and_lookup(acc):
    r = acc.post(f"{ACC}/rates/", {"date": "2026-10-10", "currency": "USD", "rate": "12050.5"}, format="json")
    assert r.status_code == 201
    assert selectors.rate_for(dt.date(2026, 10, 10), "USD") == D("12050.5")
    assert selectors.rate_for(dt.date(2026, 10, 10), "UZS") == 1
    r = acc.post(f"{ACC}/rates/", {"date": "2026-10-10", "currency": "USD", "rate": "12060"}, format="json")
    assert r.status_code == 201 and acc.get(f"{ACC}/rates/").json()["total"] == 1  # same day: updated
    assert acc.post(f"{ACC}/rates/", {"date": "2026-10-10", "currency": "UZS", "rate": "1"}, format="json").status_code == 400


def test_fetch_cbu_rates_command(acc, monkeypatch):
    from apps.accounting.management.commands import fetch_cbu_rates as cmd

    def handler(request):
        assert "cbu.uz" in str(request.url) and "/USD/2026-10-30/" in str(request.url)
        return httpx.Response(200, json=[{"Ccy": "USD", "Rate": "12345.67", "Date": "30.10.2026"}])

    monkeypatch.setattr(cmd, "TRANSPORT", httpx.MockTransport(handler))
    call_command("fetch_cbu_rates", date="2026-10-30", verbosity=0)
    assert selectors.rate_for(dt.date(2026, 10, 30), "USD") == D("12345.67")
    # a hand-typed rate wins over the daily fetch unless --force
    acc.post(f"{ACC}/rates/", {"date": "2026-10-30", "currency": "USD", "rate": "12300"}, format="json")
    call_command("fetch_cbu_rates", date="2026-10-30", verbosity=0)
    assert selectors.rate_for(dt.date(2026, 10, 30), "USD") == D("12300")
    call_command("fetch_cbu_rates", date="2026-10-30", force=True, verbosity=0)
    assert selectors.rate_for(dt.date(2026, 10, 30), "USD") == D("12345.67")


# ---------------------------------------------------------------- chart and roles


def test_role_remap_changes_next_posting_only(acc):
    s = _client(acc, "AKFA")
    first = _invoice(acc, kind="supplier", partner_id=s["id"], lines=[{"name": "a", "qty": "1", "price": "100"}])
    first = _confirm(acc, first["id"])
    role = next(r for r in acc.get(f"{ACC}/roles/").json() if r["key"] == "ap_suppliers")
    assert role["account"]["code"] == "6010"
    r = acc.patch(f"{ACC}/roles/{role['id']}/", {"account_id": account_id("6020")}, format="json")
    assert r.status_code == 200 and r.json()["account"]["code"] == "6020"
    second = _invoice(acc, kind="supplier", partner_id=s["id"], lines=[{"name": "b", "qty": "1", "price": "100"}])
    second = _confirm(acc, second["id"])
    assert {c for c, _, k in _entry_lines(acc, second["entry_id"]) if k} == {"6020"}
    assert {c for c, _, k in _entry_lines(acc, first["entry_id"]) if k} == {"6010"}  # unchanged
    # a group account cannot take a role
    assert acc.patch(f"{ACC}/roles/{role['id']}/", {"account_id": account_id("6000")}, format="json").status_code == 400


def test_used_account_cannot_be_deleted_only_deactivated(acc):
    _manual(acc, "2026-10-10", "x", [_line("5010", debit="10"), _line("8330", credit="10")])
    assert acc.delete(f"{ACC}/accounts/{account_id('5010')}/").status_code == 409
    r = acc.patch(f"{ACC}/accounts/{account_id('5010')}/", {"is_active": False}, format="json")
    assert r.status_code == 200 and r.json()["is_active"] is False and r.json()["has_lines"] is True
    # a new NSBU account can be added and, unused, deleted
    r = acc.post(f"{ACC}/accounts/", {"code": "6030", "name": "Test", "kind": "liability", "parent_id": account_id("6000")},
                 format="json")
    assert r.status_code == 201
    dup = acc.post(f"{ACC}/accounts/", {"code": "6030", "name": "Dup", "kind": "liability"}, format="json")
    assert dup.status_code == 400 and dup.json()["error"]["field"] == "code"
    assert acc.delete(f"{ACC}/accounts/{r.json()['id']}/").status_code == 204
    assert len(acc.get(f"{ACC}/accounts/").json()) > 100  # the whole chart, unpaged


def test_seed_is_idempotent_and_keeps_remaps(acc):
    from apps.accounting.models import AccountRole

    role = AccountRole.objects.get(key="ap_suppliers")
    role.account = Account.objects.get(code="6020")
    role.save()
    n = Account.objects.count()
    call_command("seed_accounting", verbosity=0)
    assert Account.objects.count() == n
    assert AccountRole.objects.get(key="ap_suppliers").account.code == "6020"


# ---------------------------------------------------------------- access


def test_permissions(api, acc):
    s = _client(acc, "AKFA")
    manager = _user_with(api, acc, "manager1", {"projects": ["view"], "clients": ["view"]})
    assert manager.get(f"{ACC}/entries/").status_code == 403
    assert manager.get(f"{ACC}/invoices/").status_code == 403
    assert manager.get(f"{ACC}/reports/trial-balance/").status_code == 403
    assert manager.get(f"{ACC}/balances/partner/{s['id']}/").status_code == 200  # the client card shows it
    viewer = _user_with(api, acc, "viewer1", {"accounting": ["view"], "invoices": ["view"], "accounting_reports": ["view"]})
    assert viewer.get(f"{ACC}/entries/").status_code == 200
    assert viewer.post(f"{ACC}/entries/", {"date": "2026-10-10", "memo": "x", "lines": []}, format="json").status_code == 403
    assert viewer.get(f"{ACC}/reports/trial-balance/").status_code == 200
    inv = _invoice(acc, kind="supplier", partner_id=s["id"], lines=[{"name": "a", "qty": "1", "price": "100"}])
    assert viewer.post(f"{ACC}/invoices/{inv['id']}/confirm/", {}, format="json").status_code == 403
    e = _manual(acc, "2026-10-10", "x", [_line("5010", debit="10"), _line("8330", credit="10")])
    assert viewer.post(f"{ACC}/entries/{e['id']}/reverse/", {}, format="json").status_code == 403
    # invoice from a Loyiha needs invoices.create, not accounting
    p = _project(acc, s["id"])
    assert manager.post(f"{API}/projects/{p['id']}/invoice/", {}, format="json").status_code == 403
    maker = _user_with(api, acc, "maker1", {"invoices": ["view", "create"]})
    assert maker.post(f"{API}/projects/{p['id']}/invoice/", {}, format="json").status_code == 201


def test_storekeeper_posts_through_the_service_without_accounting_pages(acc):
    """A document of another app posts via services.entry_post with its own actor; no accounting page needed."""
    from apps.clients.models import Client

    s = _client(acc, "AKFA")
    partner = Client.objects.get(pk=s["id"])
    storekeeper = User.objects.create_user(username="ombor", password="x")
    receipt = services.entry_post(actor=storekeeper, date=dt.date(2026, 10, 12), memo="Kirim KR-00001", lines=[
        {"role": "materials", "debit": D("1000000"), "memo": "Profil"},
        {"role": "ap_suppliers", "credit": D("1000000"), "partner": partner},
    ])
    assert receipt.code == "BX-00001" and receipt.posted_by == storekeeper
    assert selectors.partner_balance(partner)["ap"] == D("1000000")
    services.entry_reverse(receipt, actor=storekeeper)
    assert selectors.partner_balance(partner)["ap"] == 0  # reversed entries do not count
    assert services.advance_offset_lines(partner=partner, side="supplier", amount=D("500")) == []


def test_project_money_in_the_loyiha_currency(acc):
    """A USD Loyiha reads its ledger money in USD (at its usd_rate) next to the so'm figures."""
    from apps.accounting import services
    from apps.clients.models import Client
    from apps.projects.models import Project

    c = _client(acc)
    p = _project(acc, c["id"], amount="8500", currency="USD", usd_rate="11935")
    project, partner = Project.objects.get(pk=p["id"]), Client.objects.get(pk=c["id"])
    services.entry_post(actor=None, date=dt.date(2026, 10, 30), memo="HF", lines=[
        {"role": "ar_customers", "debit": D("101447500"), "partner": partner, "project": project},
        {"role": "revenue_products", "credit": D("101447500"), "project": project}])
    services.entry_post(actor=None, date=dt.date(2026, 10, 30), memo="PKO", lines=[
        {"role": "cash_uzs", "debit": D("30000000")},
        {"role": "ar_customers", "credit": D("30000000"), "partner": partner, "project": project}])
    m = acc.get(f"{API}/projects/{p['id']}/").json()["money"]
    assert (m["currency"], D(m["rate"])) == ("USD", D("11935"))
    assert (D(m["invoiced"]), D(m["paid"]), D(m["debt"])) == (D("101447500"), D("30000000"), D("71447500"))
    assert (D(m["invoiced_cur"]), D(m["paid_cur"]), D(m["debt_cur"])) == (D("8500.00"), D("2513.62"), D("5986.38"))
    # a so'm Loyiha carries no *_cur keys
    p2 = _project(acc, c["id"])
    m2 = acc.get(f"{API}/projects/{p2['id']}/").json()["money"]
    assert m2["currency"] == "UZS" and "debt_cur" not in m2
