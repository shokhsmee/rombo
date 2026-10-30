"""add-dashboard-analytics: the scenarios of openspec/changes/add-dashboard-analytics/specs/dashboard/spec.md."""

import datetime as dt
from decimal import Decimal

import pytest

from apps.accounting.models import Account
from apps.accounting.seed import seed_chart
from apps.procurement.tests import _user_with
from conftest import API

D = Decimal


@pytest.fixture(autouse=True)
def _chart(db):
    seed_chart()


def _dash(client):
    r = client.get(f"{API}/dashboard/")
    assert r.status_code == 200, r.content
    return {s["key"]: s for s in r.json()["sections"]}


def _kpi(section, key):
    return next(k for k in section["kpis"] if k["key"] == key)["value"]


def test_admin_sees_every_section(admin):
    assert set(_dash(admin)) == {"sales", "crm", "procurement", "finance", "accounting", "inventory", "hr"}
    months = admin.get(f"{API}/dashboard/").json()["months"]
    assert len(months) == 12 and months[-1] == dt.date.today().strftime("%Y-%m")


def test_sections_follow_permissions(api, admin):
    viewer = _user_with(
        api,
        admin,
        "direktor",
        {"dashboard": {"can_view": True}, "projects": {"can_view": True}, "stock": {"can_view": True}},
    )
    assert set(_dash(viewer)) == {"sales", "inventory"}
    nobody = _user_with(api, admin, "begona", {"projects": {"can_view": True}})
    assert nobody.get(f"{API}/dashboard/").status_code == 403


def _line(code, **side):
    return {"account_id": Account.objects.get(code=code).pk, **{k: str(v) for k, v in side.items()}}


def test_ledger_numbers(admin):
    today = dt.date.today().isoformat()
    for lines in (
        [_line("4010", debit=4000000), _line("9010", credit=4000000)],
        [_line("9110", debit=2500000), _line("2810", credit=2500000)],
    ):
        r = admin.post(
            f"{API}/accounting/entries/", {"date": today, "memo": "test", "lines": lines}, format="json"
        )
        assert r.status_code == 201, r.content
    acc = _dash(admin)["accounting"]
    assert (D(_kpi(acc, "revenue")), D(_kpi(acc, "cogs")), D(_kpi(acc, "margin"))) == (
        D("4000000"),
        D("2500000"),
        D("1500000"),
    )
    last = acc["series"]["pnl"][-1]
    assert (D(last["revenue"]), D(last["cost"])) == (D("4000000"), D("2500000"))
    assert D(_kpi(acc, "ar")) == D("4000000")


def test_stock_by_category(admin):
    def product(name, unit, category):
        r = admin.post(
            f"{API}/inventory/products/", {"name": name, "unit": unit, "category": category}, format="json"
        )
        assert r.status_code == 201, r.content
        return r.json()["id"]

    for pid, qty, cost in (
        (product("Profil", "m", "profil"), "20", "45000"),
        (product("Eshik", "dona", "tayyor"), "2", "2400000"),
    ):
        m = admin.post(
            f"{API}/inventory/moves/",
            {"type": "adjust", "product_id": pid, "qty": qty, "unit_cost": cost},
            format="json",
        ).json()
        assert admin.post(f"{API}/inventory/moves/{m['id']}/post/").status_code == 200
    inv = _dash(admin)["inventory"]
    cats = {c["key"]: D(c["value"]) for c in inv["lists"]["by_category"]}
    assert (cats["profil"], cats["tayyor"]) == (D("900000"), D("4800000"))
    assert D(_kpi(inv, "stock_value")) == D("5700000")
    assert [p["name"] for p in inv["lists"]["top_products"]] == ["Eshik", "Profil"]


def test_sales_this_month(admin):
    c = admin.post(f"{API}/clients/", {"name": "Ali Valiyev", "phone": "+998901112233"}, format="json").json()
    p = admin.post(
        f"{API}/projects/",
        {
            "name": "Uy",
            "client_id": c["id"],
            "amount": "12000000",
            "sale_date": dt.date.today().isoformat(),
            "items": [],
        },
        format="json",
    ).json()
    r = admin.post(f"{API}/projects/{p['id']}/status/", {"status": "confirmed"}, format="json")
    assert r.status_code == 200, r.content
    sales = _dash(admin)["sales"]
    assert D(_kpi(sales, "month_sales")) == D("12000000") and D(_kpi(sales, "pipeline")) == D("12000000")
    assert sales["lists"]["top_clients"][0]["name"] == "Ali Valiyev"
