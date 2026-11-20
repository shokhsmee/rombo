"""add-window-constructor: profile systems, constructions, preview, cut plan and filling the hisob-kitob."""

from decimal import Decimal

from apps.projects.models import Project
from conftest import API, login

K = f"{API}/konstruktor"
WINDOW = {"w": 1200, "h": 1400, "root": {"split": "v", "sizes": [600, 600], "cells": [
    {"fill": "glass"}, {"fill": "glass", "sash": {"type": "tilt_turn", "hinge": "left"}}]}}


def _system(admin):
    rows = admin.get(f"{K}/systems/").json()["items"]
    return admin.get(f"{K}/systems/{next(s for s in rows if s['name'] == 'Rombo Termo 65')['id']}/").json()


def _project(admin, **extra):
    c = admin.post(f"{API}/clients/", {"name": "Sardor Karimov", "phone": "+998901112233"}, format="json").json()
    r = admin.post(f"{API}/projects/", {"name": "Uy derazalari", "client_id": c["id"], "currency": "USD", **extra},
                   format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _construction(admin, pid, design=WINDOW, count=1, expect=201, **extra):
    r = admin.post(f"{K}/constructions/", {"project_id": pid, "system_id": _system(admin)["id"], "design": design,
                                           "count": count, **extra}, format="json")
    assert r.status_code == expect, r.content
    return r.json()


def test_seeded_system_maps_the_price_list(admin):
    s = _system(admin)
    roles = {(i["role"], i["name"]) for i in s["items"]}
    assert ("frame", "L -ka") in roles and ("tilt_turn", "Фурнитура оконная ПВО") in roles
    assert s["bar_length_mm"] == "6500.0" and s["needs_check"] is True


def test_item_from_another_price_list(admin):
    s = _system(admin)
    other = admin.post(f"{API}/pricing/", {"name": "Boshqa", "items": [{"name": "X", "unit": "шт", "price": "1",
                                                                        "is_active": True}]}, format="json").json()
    items = [{"role": i["role"], "price_list_item": i["price_list_item"], "factor": i["factor"]} for i in s["items"]]
    items.append({"role": "frame", "price_list_item": other["items"][0]["id"]})
    r = admin.patch(f"{K}/systems/{s['id']}/", {"items": items}, format="json")
    assert r.status_code == 400
    assert r.json()["error"]["field"].endswith("price_list_item")


def test_negative_width(admin):
    r = admin.patch(f"{K}/systems/{_system(admin)['id']}/", {"frame_width": "-1"}, format="json")
    assert r.status_code == 400 and "frame_width" in str(r.json())


def test_construction_stores_engine_output_and_items_follow(admin):
    p = _project(admin)
    c = _construction(admin, p["id"], count=4)
    assert c["code"] == "KS-00001" and c["size_label"] == "1200 × 1400, 2 katak"
    assert c["area_m2"] == "1.6800"
    assert len(c["result"]["glass"]) == 2 and c["result"]["counts"]["tilt_turn"] == 1
    _construction(admin, p["id"], design={"w": 1500, "h": 1400, "root": {"fill": "glass"}}, count=1)
    proj = admin.get(f"{API}/projects/{p['id']}/").json()
    assert proj["total_area"] in ("8.82", 8.82, "8.820")  # 1.68 × 4 + 2.1
    assert proj["total_quantity"] == 5
    # typed items are refused while constructions exist
    r = admin.patch(f"{API}/projects/{p['id']}/", {"items": [
        {"product_type_id": proj["items"][0]["product_type"]["id"], "area_m2": "1", "quantity": 1}]}, format="json")
    assert r.status_code == 409


def test_mullion_outside_the_frame(admin):
    p = _project(admin)
    bad = {"w": 1200, "h": 1400, "root": {"split": "v", "sizes": [1250, -50], "cells": [{}, {}]}}
    r = admin.post(f"{K}/constructions/", {"project_id": p["id"], "system_id": _system(admin)["id"], "design": bad},
                   format="json")
    assert r.status_code == 400
    assert r.json()["error"]["field"] == "design.root.cells.1"


def test_locked_loyiha(admin):
    p = _project(admin)
    c = _construction(admin, p["id"])
    Project.objects.filter(pk=p["id"]).update(status="production")
    r = admin.patch(f"{K}/constructions/{c['id']}/", {"count": 2}, format="json")
    assert r.status_code == 409


def test_preview_prices_without_saving(admin):
    r = admin.post(f"{K}/constructions/preview/", {"system_id": _system(admin)["id"], "design": WINDOW}, format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    names = {ln["name"]: ln for ln in body["lines"]}
    assert names["L -ka"]["qty"] == "1.00"  # 4 frame pieces fit one 6.5 m bar
    assert names["Фурнитура оконная ПВО"]["qty"] == "1.00"
    assert body["totals"]["USD"]
    from apps.konstruktor.models import Construction

    assert not Construction.objects.exists()


def test_fill_calc_from_constructions(admin):
    p = _project(admin)
    _construction(admin, p["id"], count=2)
    summary = admin.get(f"{K}/projects/{p['id']}/summary/").json()
    frame_bars = next(ln for ln in summary["lines"] if ln["name"] == "L -ka")["qty"]
    r = admin.post(f"{K}/projects/{p['id']}/fill-calc/", format="json")
    assert r.status_code == 200, r.content
    calc_id = r.json()["calcs"][0]["id"]
    calc = admin.get(f"{API}/projects/{p['id']}/calcs/{calc_id}/").json()
    lines = {ln["name"]: ln for ln in calc["lines"]}
    assert lines["L -ka"]["qty"] == frame_bars and lines["L -ka"]["source"] == "chizma"
    # sales types a manual line; a refill keeps it
    dem = lines["Демонтаж"]
    admin.patch(f"{API}/projects/{p['id']}/calcs/{calc_id}/", {"lines": [{"id": dem["id"], "qty": "1"}]},
                format="json")
    admin.post(f"{K}/projects/{p['id']}/fill-calc/", format="json")
    calc = admin.get(f"{API}/projects/{p['id']}/calcs/{calc_id}/").json()
    lines = {ln["name"]: ln for ln in calc["lines"]}
    assert lines["Демонтаж"]["qty"] == "1.00" and lines["Демонтаж"]["source"] == "manual"
    assert Decimal(calc["total"]) > 0
    assert admin.get(f"{API}/projects/{p['id']}/").json()["amount"] == f"{Decimal(calc['total']):.2f}"


def test_cut_plan_pools_the_loyiha(admin):
    p = _project(admin)
    _construction(admin, p["id"], count=3)
    cut = admin.get(f"{K}/projects/{p['id']}/summary/").json()["cut"]
    frame = next(v for v in cut.values() if v["item"] == "L -ka")
    pieces = sum(len(b["pieces"]) for b in frame["bars"])
    assert pieces == 12  # 4 frame pieces × 3 windows, cut together
    assert all(b["offcut"] >= 0 for b in frame["bars"])


def test_sales_cannot_edit_a_profile_system(api, admin):
    from apps.access.models import Role

    rid = Role.objects.get(name="Savdo menejeri").pk
    r = admin.post(f"{API}/users/", {"username": "sotuv", "first_name": "Sotuvchi", "password": "password123",
                                     "role_ids": [rid]}, format="json")
    assert r.status_code == 201, r.content
    sales = login(api, "sotuv", "password123")
    sid = _system(admin)["id"]
    assert sales.get(f"{K}/systems/{sid}/").status_code == 200
    assert sales.patch(f"{K}/systems/{sid}/", {"kerf_mm": "4"}, format="json").status_code == 403


def test_mrp_need_from_constructions(admin):
    from apps.inventory.models import Product
    from apps.mrp.selectors import live_need
    from apps.pricing.models import PriceListItem

    item = PriceListItem.objects.get(name="L -ka", price_list__name="Rombo Termo 306J 65 seriya")
    prod = Product.objects.create(name="L-ka profil", unit="m", purchase_unit="dona", purchase_factor=Decimal("6.5"),
                                  price_item=item, category="profil")
    p = _project(admin)
    _construction(admin, p["id"], count=2)
    bars = Decimal(next(ln for ln in admin.get(f"{K}/projects/{p['id']}/summary/").json()["lines"]
                        if ln["name"] == "L -ka")["qty"])
    assert live_need(Project.objects.get(pk=p["id"]))[prod.pk] == bars * Decimal("6.5")


def test_system_change_does_not_recut_existing_constructions(admin):
    p = _project(admin)
    _construction(admin, p["id"])
    before = admin.get(f"{K}/projects/{p['id']}/summary/").json()["cut"]
    admin.patch(f"{K}/systems/{_system(admin)['id']}/", {"weld_allowance": "10"}, format="json")
    assert admin.get(f"{K}/projects/{p['id']}/summary/").json()["cut"] == before
