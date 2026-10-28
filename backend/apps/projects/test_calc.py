from conftest import API, login

TERMO = "Rombo Termo 306J 65 seriya"

# Quantities from the sales department's sample sheet (06.08.2026); its printed total is 1 080.
SAMPLE_QTY = {
    "L -ka": "4.5", "T-ka": "1", "Балкон T": "2.5", "Штапик квадрат": "4.5", "Штульп": "0.5", "Елка+клей": "24",
    "Шпингалет": "1", "Замок": "1", "Петля дверная 2ска": "8", "Стекло пакет пепель": "10",
    "Резина Босма A001 - юшка": "29.25", "Резина Босма A002 - босма стеклопакет таги": "52",
    "Резина Босма A003 - створка (L+T+Z) майда": "45.5", "Резина Босма A005 - урта резин калин": "16.25",
    "Соединитель лапша": "1",
}


def _pricelist(admin):
    lists = admin.get(f"{API}/pricing/").json()["items"]
    return next(p for p in lists if p["name"] == TERMO)


def _project(admin, **extra):
    c = admin.post(f"{API}/clients/", {"name": "Сухроб Алиев", "phone": "+998915396659"}, format="json").json()
    r = admin.post(f"{API}/projects/", {"name": "Eshik va rom", "client_id": c["id"], **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _calc(admin, pid):
    r = admin.post(f"{API}/projects/{pid}/calcs/", {"price_list_id": _pricelist(admin)["id"]}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _fill_sample(admin, pid, calc):
    lines = [{"id": ln["id"], "qty": SAMPLE_QTY[ln["name"]]} for ln in calc["lines"] if ln["name"] in SAMPLE_QTY]
    r = admin.patch(f"{API}/projects/{pid}/calcs/{calc['id']}/", {"lines": lines}, format="json")
    assert r.status_code == 200, r.content
    return r.json()


def test_seeded_price_list_matches_the_sample(admin):
    pl = admin.get(f"{API}/pricing/{_pricelist(admin)['id']}/").json()
    assert pl["currency"] == "USD" and pl["bar_length_m"] == "6.50"
    assert len(pl["items"]) == 38
    assert pl["items"][0] == {"id": pl["items"][0]["id"], "name": "L -ka", "unit": "шт", "price": "51.40", "is_active": True}


def test_sample_sheet_totals_1080_with_half_up_rounding(admin):
    p = _project(admin, currency="USD")
    calc = _fill_sample(admin, p["id"], _calc(admin, p["id"]))
    sums = {ln["name"]: ln["line_sum"] for ln in calc["lines"] if ln["qty"] != "0.00"}
    assert sums["L -ka"] == "231" and sums["Балкон T"] == "201" and sums["Резина Босма A001 - юшка"] == "7"
    assert calc["total"] == "1080"
    # order in USD: the amount is the calculation total
    assert admin.get(f"{API}/projects/{p['id']}/").json()["amount"] == "1080.00"


def test_amount_in_soum_uses_usd_rate_and_ignores_manual_amount(admin):
    p = _project(admin)  # UZS by default
    _fill_sample(admin, p["id"], _calc(admin, p["id"]))
    assert admin.get(f"{API}/projects/{p['id']}/").json()["amount"] == "0.00"  # no rate yet: left as is
    r = admin.patch(f"{API}/projects/{p['id']}/", {"usd_rate": "12000", "amount": "5"}, format="json").json()
    assert r["amount"] == "12960000.00"  # 1 080 × 12 000, manual "5" ignored


def test_price_change_does_not_reprice_until_refresh(admin):
    p = _project(admin, currency="USD")
    calc = _fill_sample(admin, p["id"], _calc(admin, p["id"]))
    pl = admin.get(f"{API}/pricing/{_pricelist(admin)['id']}/").json()
    items = [{**it, "price": "61.40"} if it["name"] == "L -ka" else it for it in pl["items"]]
    assert admin.patch(f"{API}/pricing/{pl['id']}/", {"items": items}, format="json").status_code == 200

    again = admin.get(f"{API}/projects/{p['id']}/calcs/{calc['id']}/").json()
    assert again["total"] == "1080"
    fresh = admin.post(f"{API}/projects/{p['id']}/calcs/{calc['id']}/refresh-prices/").json()
    assert fresh["total"] == "1125"  # 4.5 × 61.4 = 276.3 → 276 (+45)
    assert admin.get(f"{API}/projects/{p['id']}/").json()["amount"] == "1125.00"


def test_calc_locks_with_production(admin):
    p = _project(admin, currency="USD")
    calc = _calc(admin, p["id"])
    for s in ("confirmed", "production"):
        admin.post(f"{API}/projects/{p['id']}/status/", {"status": s}, format="json")
    r = admin.patch(f"{API}/projects/{p['id']}/calcs/{calc['id']}/", {"lines": []}, format="json")
    assert r.status_code == 409


def test_sales_reads_prices_but_cannot_change_them(api, admin):
    role = admin.get(f"{API}/access/roles/", {"q": "Savdo"}).json()["items"][0]
    admin.post(f"{API}/users/", {"username": "sotuvchi", "first_name": "S", "password": "password123",
                                 "role_ids": [role["id"]]}, format="json")
    seller = login(api, "sotuvchi", "password123")
    pl = _pricelist(seller)
    assert seller.patch(f"{API}/pricing/{pl['id']}/", {"name": "X"}, format="json").status_code == 403
    assert seller.get(f"{API}/company/").json()["name"] == "Rombo Group"
    assert seller.patch(f"{API}/company/", {"name": "X"}, format="json").status_code == 403
