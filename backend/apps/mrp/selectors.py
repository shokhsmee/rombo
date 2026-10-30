"""Reads of MRP: BOM explosion and cost, Loyiha materials, the net-requirements plan (design D2–D7)."""

from __future__ import annotations

import math
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Q, Sum

from apps.inventory import selectors as inv
from apps.inventory.models import Category, MoveStatus, MoveType, Product
from apps.mrp.models import Basis, Bom, ItemSpec, ProjectMaterial

ZERO = Decimal("0")
Q3 = Decimal("0.001")
OPEN_PROJECT = ("confirmed", "procurement", "production", "ready")


def q3(v) -> Decimal:
    return Decimal(v).quantize(Q3, rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------ BOM


def active_bom(product) -> Bom | None:
    pid = getattr(product, "pk", product)
    return Bom.objects.filter(product_id=pid, is_active=True).prefetch_related("lines__component").first()


def explode(product, count, area, *, _path: tuple = ()) -> dict[int, Decimal]:
    """{component product id: qty} for `count` pieces covering `area` m² in total. Components that are
    semi-finished (`yarim`) with an active BOM are exploded further, per unit of the component."""
    bom = active_bom(product)
    if bom is None:
        return {}
    out: dict[int, Decimal] = defaultdict(lambda: ZERO)
    count, area = Decimal(count), Decimal(area or 0)
    for ln in bom.lines.all():
        base = area if ln.basis == Basis.M2 else count
        need = ln.qty * base * (1 + ln.waste_pct / 100)
        comp = ln.component
        if comp.category == Category.YARIM and comp.pk not in _path and active_bom(comp) is not None:
            for pid, q in explode(comp, need, need, _path=(*_path, bom.product_id)).items():
                out[pid] += q
        else:
            out[comp.pk] += need
    return {pid: q3(q) for pid, q in out.items() if q > 0}


def contains(bom_product_id: int, component_id: int, _seen: set | None = None) -> bool:
    """True when `component_id` is the product itself or (through active BOMs) contains it."""
    if component_id == bom_product_id:
        return True
    seen = _seen if _seen is not None else set()
    if component_id in seen:
        return False
    seen.add(component_id)
    bom = active_bom(component_id)
    return bool(bom) and any(contains(bom_product_id, ln.component_id, seen) for ln in bom.lines.all())


def unit_cost(product) -> Decimal:
    avg = inv.average_cost(product)
    return avg if avg is not None else product.default_cost


def bom_cost(bom: Bom) -> dict:
    """Planned cost: per piece (dona lines) and per m² (m2 lines), components at average cost; a
    semi-finished component with a BOM is costed by its own BOM when it has no stock cost."""
    per_piece, per_m2, rows = ZERO, ZERO, []
    for ln in bom.lines.select_related("component"):
        comp = ln.component
        cost = unit_cost(comp)
        if not cost and comp.category == Category.YARIM:
            sub = active_bom(comp)
            if sub is not None and sub.pk != bom.pk:
                c = bom_cost(sub)
                cost = c["per_piece"] + c["per_m2"]
        line = ln.qty * (1 + ln.waste_pct / 100) * cost
        if ln.basis == Basis.M2:
            per_m2 += line
        else:
            per_piece += line
        rows.append({"line_id": ln.pk, "unit_cost": str(q3(cost)), "cost": str(q3(line))})
    return {"per_piece": per_piece.quantize(Decimal("0.01")), "per_m2": per_m2.quantize(Decimal("0.01")),
            "lines": rows}


# ------------------------------------------------------------------ Loyiha items and materials


def item_rows(project) -> list[dict]:
    """The Loyiha's items in order with the product each one means (ItemSpec by position + type)."""
    specs = {s.position: s for s in ItemSpec.objects.filter(project=project).select_related("product")}
    rows = []
    for i, it in enumerate(project.items.select_related("product_type").order_by("id")):
        s = specs.get(i)
        valid = s is not None and s.product_type_id == it.product_type_id
        product = s.product if valid else None
        rows.append({"position": i, "item": it, "product": product,
                     "has_bom": bool(product and active_bom(product))})
    return rows


def live_need(project) -> dict[int, Decimal]:
    out: dict[int, Decimal] = defaultdict(lambda: ZERO)
    for r in item_rows(project):
        if r["product"] is not None:
            for pid, q in explode(r["product"], r["item"].quantity, r["item"].area_m2).items():
                out[pid] += q
    return dict(out)


def frozen(project) -> bool:
    return ProjectMaterial.objects.filter(project=project).exists()


def need_of(project) -> dict[int, Decimal]:
    if frozen(project):
        return {m.product_id: m.qty for m in ProjectMaterial.objects.filter(project=project)}
    return live_need(project)


def issued_of(project) -> dict[int, Decimal]:
    rows = (inv.posted().filter(project=project, type=MoveType.ISSUE).values("product_id")
            .annotate(q=Sum("qty")))
    return {r["product_id"]: r["q"] for r in rows}


def requested_of(project) -> dict[int, Decimal]:
    """Product-linked purchase-request quantities of the Loyiha still alive (not rejected / cancelled)."""
    from apps.procurement.models import PurchaseRequestLine, RequestStatus

    rows = (PurchaseRequestLine.objects.filter(request__project=project, product__isnull=False,
                                                request__deleted_at__isnull=True)
            .exclude(request__status__in=[RequestStatus.REJECTED, RequestStatus.CANCELLED])
            .values("product_id").annotate(q=Sum("qty")))
    return {r["product_id"]: r["q"] for r in rows}


def _stock(ids, warehouse=None) -> dict[int, Decimal]:
    """On hand per product: in `warehouse` when given, else in all warehouses."""
    if warehouse:
        return inv.warehouse_products(int(warehouse), ids)
    return {pid: q for pid, (q, _v) in inv.products_on_hand(ids).items()}


def finished_of(project, warehouse=None) -> list[dict]:
    """The Loyiha's finished goods: products of its items plus anything produced for it, with made,
    delivered and in stock (for "Tayyor mahsulotni qabul qilish" and "Mijozga yetkazish")."""
    moves = inv.posted().filter(project=project, type__in=[MoveType.OUTPUT, MoveType.DELIVERY])
    made: dict[int, Decimal] = defaultdict(lambda: ZERO)
    gone: dict[int, Decimal] = defaultdict(lambda: ZERO)
    for m in moves.only("product_id", "type", "qty"):
        (made if m.type == MoveType.OUTPUT else gone)[m.product_id] += m.qty
    planned: dict[int, int] = defaultdict(int)
    for r in item_rows(project):
        if r["product"] is not None:
            planned[r["product"].pk] += r["item"].quantity
    ids = set(made) | set(planned)
    products = {p.pk: p for p in Product.all_objects.filter(pk__in=ids)}
    stock = _stock(ids, warehouse)
    return [{"product": {"id": pid, "code": products[pid].code, "name": products[pid].name,
                         "unit": products[pid].unit, "category": products[pid].category},
             "planned": planned.get(pid, 0), "produced": str(q3(made.get(pid, ZERO))),
             "delivered": str(q3(gone.get(pid, ZERO))), "stock": str(q3(stock.get(pid, ZERO)))}
            for pid in sorted(ids, key=lambda i: products[i].name.lower())]


def materials(project, warehouse=None) -> dict:
    need, issued, requested = need_of(project), issued_of(project), requested_of(project)
    ids = set(need) | set(issued)
    products = {p.pk: p for p in Product.all_objects.filter(pk__in=ids)}
    stock = _stock(ids, warehouse)
    rows, planned = [], ZERO
    for pid in sorted(ids, key=lambda i: (products[i].category, products[i].name.lower())):
        p = products[pid]
        n, iss = need.get(pid, ZERO), issued.get(pid, ZERO)
        cost = unit_cost(p)
        planned += n * cost
        rows.append({
            "product": {"id": p.pk, "code": p.code, "name": p.name, "unit": p.unit, "category": p.category},
            "need": str(q3(n)), "issued": str(q3(iss)), "remaining": str(q3(max(n - iss, ZERO))),
            "requested": str(q3(requested.get(pid, ZERO))), "stock": str(q3(stock.get(pid, ZERO))),
            "unit_cost": str(q3(cost)), "planned_cost": str((n * cost).quantize(Decimal("0.01"))),
        })
    items = [{"position": r["position"], "item_id": r["item"].pk, "product_type": r["item"].product_type.name,
              "area_m2": str(r["item"].area_m2), "quantity": r["item"].quantity,
              "product": None if r["product"] is None else {"id": r["product"].pk, "code": r["product"].code,
                                                             "name": r["product"].name},
              "has_bom": r["has_bom"]} for r in item_rows(project)]
    from apps.inventory.selectors import project_wip

    try:
        wip = project_wip(project)
    except Exception:  # chart not seeded
        wip = None
    return {"frozen": frozen(project), "items": items, "rows": rows, "finished": finished_of(project, warehouse),
            "planned_cost": str(planned.quantize(Decimal("0.01"))),
            "wip": None if wip is None else str(wip),
            "issued_any": bool(issued)}


# ------------------------------------------------------------------ plan (net requirements)


def on_order() -> dict[int, Decimal]:
    from apps.procurement.models import OrderStatus, PurchaseOrderLine

    out: dict[int, Decimal] = defaultdict(lambda: ZERO)
    lines = PurchaseOrderLine.objects.filter(
        product__isnull=False, order__deleted_at__isnull=True,
        order__status__in=[OrderStatus.SENT, OrderStatus.PARTIALLY_RECEIVED])
    for ln in lines.only("product_id", "qty", "received_qty"):
        out[ln.product_id] += max(ln.qty - ln.received_qty, ZERO)
    return dict(out)


def requested_open() -> dict[int, Decimal]:
    """Product-linked request quantity not yet put on an order (submitted / approved requests)."""
    from apps.procurement.models import PurchaseRequestLine, RequestStatus

    out: dict[int, Decimal] = defaultdict(lambda: ZERO)
    lines = PurchaseRequestLine.objects.filter(
        product__isnull=False, request__deleted_at__isnull=True,
        request__status__in=[RequestStatus.DRAFT, RequestStatus.SUBMITTED, RequestStatus.APPROVED])
    for ln in lines.only("product_id", "qty", "ordered_qty"):
        out[ln.product_id] += max(ln.qty - ln.ordered_qty, ZERO)
    return dict(out)


def round_up(qty: Decimal, multiple: Decimal | None) -> Decimal:
    if qty <= 0:
        return ZERO
    if not multiple or multiple <= 0:
        return q3(qty)
    return q3(Decimal(math.ceil(qty / multiple)) * multiple)


def plan(*, project=None, category=None, deadline_before=None, only_short: bool = False) -> dict:
    """Net requirements over open Loyihas (design D6): need − stock − on order − requested = shortage,
    rounded up to the product's purchase multiple; shortage is given to Loyihas by earliest deadline."""
    from apps.projects.models import Project

    projects = Project.objects.filter(status__in=OPEN_PROJECT).select_related("client")
    if deadline_before:
        projects = projects.filter(Q(deadline__lte=deadline_before) | Q(deadline__isnull=True))
    by_product: dict[int, list] = defaultdict(list)
    for p in projects:
        need, issued = need_of(p), issued_of(p)
        for pid, n in need.items():
            rem = max(n - issued.get(pid, ZERO), ZERO)
            if rem > 0:
                by_product[pid].append((p, rem))
    ids = set(by_product)
    products = {p.pk: p for p in Product.all_objects.filter(pk__in=ids)}
    if category:
        ids = {i for i in ids if products[i].category == category}
    hand = inv.products_on_hand(ids)
    ordered, asked = on_order(), requested_open()
    rows = []
    for pid in ids:
        prod = products[pid]
        uses = sorted(by_product[pid], key=lambda t: (t[0].deadline is None, t[0].deadline or 0, t[0].pk))
        need = sum((q for _, q in uses), ZERO)
        stock = max(hand.get(pid, (ZERO, ZERO))[0], ZERO)
        coming = ordered.get(pid, ZERO) + asked.get(pid, ZERO)
        short = max(need - stock - coming, ZERO)
        cover = stock + coming
        alloc = []
        for p, q in uses:  # first need first served
            take = min(q, cover)
            cover -= take
            alloc.append({"project": {"id": p.pk, "code": p.code, "name": p.name, "client": p.client.name,
                                      "deadline": p.deadline.isoformat() if p.deadline else None},
                          "need": str(q3(q)), "covered": str(q3(take)), "short": str(q3(q - take))})
        if project and not any(a["project"]["id"] == int(project) for a in alloc):
            continue
        if only_short and short <= 0:
            continue
        rows.append({
            "product": {"id": prod.pk, "code": prod.code, "name": prod.name, "unit": prod.unit,
                        "category": prod.category, "order_multiple": None if prod.order_multiple is None
                        else str(prod.order_multiple)},
            "need": str(q3(need)), "stock": str(q3(stock)), "on_order": str(q3(ordered.get(pid, ZERO))),
            "requested": str(q3(asked.get(pid, ZERO))), "shortage": str(q3(short)),
            "to_buy": str(round_up(short, prod.order_multiple)), "projects": alloc,
        })
    rows.sort(key=lambda r: (Decimal(r["shortage"]) <= 0, r["product"]["category"], r["product"]["name"].lower()))
    return {"rows": rows, "short": sum(1 for r in rows if Decimal(r["shortage"]) > 0),
            "projects": projects.count()}
