"""Reads for procurement: last prices, lines per Loyiha, the Loyiha card block, supplier balances."""

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum

from apps.procurement.models import (
    GoodsReceiptLine,
    OrderStatus,
    PurchaseOrderLine,
    PurchaseRequest,
    ReceiptStatus,
    RequestStatus,
)

ZERO = Decimal("0")


def last_price(supplier, item) -> tuple[Decimal, str] | None:
    """(price, currency) of the last posted receipt of `item` from `supplier` — what buyers trust."""
    if item is None:
        return None
    ln = (GoodsReceiptLine.objects
          .filter(receipt__supplier=supplier, receipt__status=ReceiptStatus.POSTED, order_line__item=item)
          .select_related("receipt__order")
          .order_by("-receipt__date", "-id").first())
    return (ln.price, ln.receipt.order.currency) if ln else None


def lines_for_project(project):
    """Order lines of a Loyiha (the "Xaridlar" smart button is a query on lines, design.md)."""
    return (PurchaseOrderLine.objects.filter(project=project, order__deleted_at__isnull=True)
            .exclude(order__status=OrderStatus.CANCELLED).select_related("order"))


def project_procurement(project) -> dict:
    """The Loyiha card block: {requests, orders, received_pct}."""
    requests = PurchaseRequest.objects.filter(project=project).exclude(status=RequestStatus.CANCELLED).count()
    lines = lines_for_project(project)
    orders = lines.values("order_id").distinct().count()
    agg = lines.aggregate(ordered=Sum("qty"), received=Sum("received_qty"))
    ordered, received = agg["ordered"] or ZERO, agg["received"] or ZERO
    pct = int((received / ordered * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)) if ordered else 0
    return {"requests": requests, "orders": orders, "received_pct": min(pct, 100)}


def supplier_balance(client) -> dict:
    """{"balance_uzs", "balance_cur"} from the ledger: positive = we owe, negative = prepaid (ADR 0007)."""
    from apps.accounting import selectors as accsel
    from apps.core.exceptions import Conflict

    try:
        b = accsel.partner_balance(client)
    except Conflict:  # chart of accounts not seeded yet (roles unmapped): no balance, not an error
        return {"balance_uzs": ZERO, "balance_cur": None}
    # positive = we owe the supplier (6010), negative = we prepaid (4310); `net_cur` is {currency: amount}
    uzs = Decimal(b["ap"]) - Decimal(b["advance_paid"])
    cur = b.get("net_cur") or {}
    amount_cur = cur.get(client.price_currency) if client.price_currency != "UZS" else None
    return {"balance_uzs": uzs, "balance_cur": -amount_cur if amount_cur is not None else None}
