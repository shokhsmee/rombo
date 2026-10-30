"""Reads of the inventory. Stock on hand and its value are sums over posted moves (ADR 0010):

    receipt, output, adjust (signed)   → + in `warehouse`
    issue, delivery                    → − in `warehouse`
    transfer                           → − in `warehouse`, + in `to_warehouse`
"""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Case, Count, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce

from apps.inventory.models import ZERO, MoveStatus, MoveType, Product, StockMove, Warehouse, q2

T = MoveType
QTY_F = DecimalField(max_digits=18, decimal_places=3)
MONEY_F = DecimalField(max_digits=18, decimal_places=2)


def posted():
    return StockMove.objects.filter(status=MoveStatus.POSTED)


def _signed(field: str, *, with_transfer: bool):
    """Effect of a row on its `warehouse`; with_transfer=False drops transfers (product-wide totals)."""
    out = F(field) * Value(-1)
    whens = [When(type__in=[T.RECEIPT, T.OUTPUT, T.ADJUST], then=F(field)),
             When(type__in=[T.ISSUE, T.DELIVERY], then=out)]
    if with_transfer:
        whens.append(When(type=T.TRANSFER, then=out))
    return Case(*whens, default=Value(ZERO), output_field=QTY_F if field == "qty" else MONEY_F)


def _sum(expr, field):
    return Coalesce(Sum(expr), Value(ZERO), output_field=QTY_F if field == "qty" else MONEY_F)


# ------------------------------------------------------------------ balances


def balances(qs=None) -> dict[tuple[int, int], list[Decimal]]:
    """{(product_id, warehouse_id): [qty, value]} over posted rows of `qs` (default: all)."""
    qs = (qs if qs is not None else StockMove.objects.all()).filter(status=MoveStatus.POSTED)
    out: dict[tuple[int, int], list[Decimal]] = defaultdict(lambda: [ZERO, ZERO])
    rows = (qs.values("product_id", "warehouse_id")
            .annotate(q=_sum(_signed("qty", with_transfer=True), "qty"),
                      v=_sum(_signed("amount", with_transfer=True), "amount")))
    for r in rows:
        cell = out[(r["product_id"], r["warehouse_id"])]
        cell[0] += r["q"]
        cell[1] += r["v"]
    rows = (qs.filter(type=T.TRANSFER).values("product_id", "to_warehouse_id")
            .annotate(q=_sum("qty", "qty"), v=_sum("amount", "amount")))
    for r in rows:
        cell = out[(r["product_id"], r["to_warehouse_id"])]
        cell[0] += r["q"]
        cell[1] += r["v"]
    return out


def warehouse_qty(product, warehouse) -> Decimal:
    """What `warehouse` holds of `product` now."""
    pid, wid = getattr(product, "pk", product), getattr(warehouse, "pk", warehouse)
    qs = posted().filter(product_id=pid).filter(Q(warehouse_id=wid) | Q(to_warehouse_id=wid))
    return balances(qs).get((pid, wid), [ZERO, ZERO])[0]


def product_totals(product) -> tuple[Decimal, Decimal]:
    """(qty, value) of a product over all warehouses — the base of its average cost."""
    agg = posted().filter(product=product).aggregate(
        q=_sum(_signed("qty", with_transfer=False), "qty"), v=_sum(_signed("amount", with_transfer=False), "amount"))
    return agg["q"], agg["v"]


def average_cost(product) -> Decimal | None:
    qty, value = product_totals(product)
    if qty <= 0:
        return None
    return q2(value / qty)


def products_on_hand(product_ids) -> dict[int, tuple[Decimal, Decimal]]:
    """{product_id: (qty, value)} for a page of the product list."""
    rows = (posted().filter(product_id__in=list(product_ids)).values("product_id")
            .annotate(q=_sum(_signed("qty", with_transfer=False), "qty"),
                      v=_sum(_signed("amount", with_transfer=False), "amount")))
    return {r["product_id"]: (r["q"], r["v"]) for r in rows}


def stock(*, warehouse=None, category=None, q: str = "", nonzero: bool = True) -> dict:
    """Stock on hand per product × warehouse, with totals."""
    qs = posted()
    if warehouse:
        qs = qs.filter(Q(warehouse_id=warehouse) | Q(to_warehouse_id=warehouse))
    if category:
        qs = qs.filter(product__category=category)
    if q:
        qs = qs.filter(Q(product__name__icontains=q) | Q(product__sku__icontains=q) | Q(product__code__icontains=q))
    cells = balances(qs)
    products = {p.pk: p for p in Product.all_objects.filter(pk__in={k[0] for k in cells})}
    warehouses = {w.pk: w for w in Warehouse.objects.filter(pk__in={k[1] for k in cells})}
    rows, total_value = [], ZERO
    for (pid, wid), (qty, value) in cells.items():
        if warehouse and wid != int(warehouse):
            continue
        if nonzero and qty == 0 and value == 0:
            continue
        p, w = products[pid], warehouses[wid]
        rows.append({
            "product": {"id": p.pk, "code": p.code, "name": p.name, "sku": p.sku, "unit": p.unit,
                        "category": p.category},
            "warehouse": {"id": w.pk, "name": w.name},
            "qty": str(qty), "value": str(q2(value)),
            "avg_cost": str(q2(value / qty)) if qty > 0 else None,
        })
        total_value += value
    rows.sort(key=lambda r: (r["product"]["name"].lower(), r["warehouse"]["name"]))
    return {"rows": rows, "total_value": str(q2(total_value)), "products": len({r["product"]["id"] for r in rows})}


def stock_value() -> Decimal:
    agg = posted().aggregate(v=_sum(_signed("amount", with_transfer=False), "amount"))
    return agg["v"]


# ------------------------------------------------------------------ summaries


def summary(qs) -> dict:
    """KPI row of the moves list: posted rows of the filtered queryset."""
    qs = qs.filter(status=MoveStatus.POSTED)
    agg = qs.aggregate(
        count=Count("id"),
        kirim=_sum(Case(When(type__in=[T.RECEIPT, T.OUTPUT], then=F("amount")),
                        When(type=T.ADJUST, amount__gt=0, then=F("amount")), default=Value(ZERO),
                        output_field=MONEY_F), "amount"),
        chiqim=_sum(Case(When(type=T.ISSUE, then=F("amount")),
                         When(type=T.ADJUST, amount__lt=0, then=F("amount") * Value(-1)), default=Value(ZERO),
                         output_field=MONEY_F), "amount"),
        yetkazish=_sum(Case(When(type=T.DELIVERY, then=F("amount")), default=Value(ZERO), output_field=MONEY_F),
                       "amount"),
    )
    return {"count": agg["count"], "kirim": str(agg["kirim"]), "chiqim": str(agg["chiqim"]),
            "yetkazish": str(agg["yetkazish"]), "stock_value": str(q2(stock_value()))}


def project_block(project) -> dict:
    """The Loyiha card's "Ombor" block (projects.extensions)."""
    agg = posted().filter(project=project).aggregate(
        moves=Count("id"),
        issued=_sum(Case(When(type=T.ISSUE, then=F("amount")), default=Value(ZERO), output_field=MONEY_F), "amount"),
        output=_sum(Case(When(type=T.OUTPUT, then=F("amount")), default=Value(ZERO), output_field=MONEY_F), "amount"),
        delivered=_sum(Case(When(type=T.DELIVERY, then=F("amount")), default=Value(ZERO), output_field=MONEY_F),
                       "amount"),
    )
    return {"moves": agg["moves"], "issued": str(agg["issued"]), "output": str(agg["output"]),
            "delivered": str(agg["delivered"]), "wip": _wip_or_none(project)}


def project_wip(project) -> Decimal:
    """Work in progress of a Loyiha = ledger balance of the `wip` role on it."""
    from apps.accounting import selectors as ledger

    return ledger.account_balance("wip", project=project)


def _wip_or_none(project) -> str | None:
    from apps.core.exceptions import Conflict

    try:
        return str(project_wip(project))
    except Conflict:  # chart not seeded yet
        return None
