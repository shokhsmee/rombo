"""Reads of the kassa: every balance comes from the ledger (ADR 0007), the lists come from the orders.

    account_balance_pair(acc) -> (balance in acc.currency, balance in UZS)
    summary() -> totals for the Kassa page KPI row
    cash_book(acc, date) -> opening, the day's posted orders, totals, closing, limit warning
    project_payments(project) -> {count, paid, last_date}         (Loyiha card block "payments")
    project_advance(project) -> {amount, date} | None              (derived advance_amount / advance_date)
    partner_payments(partner) -> {count, paid_in, paid_out}
    invoice_open(invoice, currency, rate) -> open amount of an invoice in `currency` (the AR/AP cap)
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.db.models import Count, F, Max, Q, Sum

from apps.accounting import selectors as ledger
from apps.accounting.models import ZERO, InvoiceKind, q2
from apps.kassa.models import UZS, AccountKind, CashAccount, CashOrder, OrderKind, OrderStatus, Posting

# ------------------------------------------------------------------ balances


def account_balance_pair(acc: CashAccount, *, on: dt.date | None = None) -> tuple[Decimal, Decimal]:
    uzs = ledger.account_balance(acc.account, on=on)
    if acc.currency == UZS:
        return uzs, uzs
    return ledger.account_balance_cur(acc.account, currency=acc.currency, on=on), uzs


def account_balance(acc: CashAccount, *, on: dt.date | None = None) -> Decimal:
    """In the account's own currency — what 'no overdraft' compares the amount with."""
    return account_balance_pair(acc, on=on)[0]


def posted_orders():
    return CashOrder.objects.filter(status=OrderStatus.POSTED)


def _uzs_sum(qs) -> Decimal:
    """Σ amount × rate over orders (rate is null for UZS)."""
    total = ZERO
    for amount, currency, rate in qs.values_list("amount", "currency", "rate"):
        total += amount if currency == UZS or not rate else q2(amount * rate)
    return total


def summary() -> dict:
    today = dt.date.today()
    month_start = today.replace(day=1)
    accounts = []
    cash_uzs = bank_uzs = ZERO
    for acc in CashAccount.objects.filter(is_active=True).select_related("account"):
        bal, bal_uzs = account_balance_pair(acc)
        accounts.append({"id": acc.pk, "name": acc.name, "kind": acc.kind, "currency": acc.currency,
                         "balance": bal, "balance_uzs": bal_uzs})
        if acc.kind == AccountKind.CASH:
            cash_uzs += bal_uzs
        else:
            bank_uzs += bal_uzs
    month = posted_orders().filter(date__gte=month_start, date__lte=today)
    return {
        "total_uzs": cash_uzs + bank_uzs, "cash_uzs": cash_uzs, "bank_uzs": bank_uzs,
        "month_in": _uzs_sum(month.filter(kind=OrderKind.IN)),
        "month_out": _uzs_sum(month.filter(kind=OrderKind.OUT)),
        "today_in": _uzs_sum(month.filter(kind=OrderKind.IN, date=today)),
        "today_out": _uzs_sum(month.filter(kind=OrderKind.OUT, date=today)),
        "drafts": CashOrder.objects.filter(status=OrderStatus.DRAFT).count(),
        "accounts": accounts,
    }


# ------------------------------------------------------------------ cash book


def cash_book(acc: CashAccount, date: dt.date) -> dict:
    """Kassa kitobi for one day: opening = ledger balance the day before, the day's posted orders of this
    account (transfers in and out included), closing = ledger balance at the end of the day. Movements on
    the account that are not kassa orders (opening balances, accountant corrections) show as `other`."""
    opening = account_balance(acc, on=date - dt.timedelta(days=1))
    closing = account_balance(acc, on=date)
    qs = (posted_orders().filter(Q(account=acc) | Q(to_account=acc), date=date)
          .select_related("account", "to_account", "purpose", "partner", "project", "employee")
          .order_by("code", "id"))
    rows, total_in, total_out = [], ZERO, ZERO
    for o in qs:
        incoming = o.kind == OrderKind.IN or (o.kind == OrderKind.TRANSFER and o.to_account_id == acc.pk)
        if incoming:
            total_in += o.amount
        else:
            total_out += o.amount
        counter = (o.to_account.name if o.to_account_id and o.to_account_id != acc.pk else
                   o.account.name if o.kind == OrderKind.TRANSFER else "")
        rows.append({
            "id": o.pk, "code": o.code, "kind": o.kind,
            "partner": {"id": o.partner.pk, "name": o.partner.name} if o.partner else None,
            "project": {"id": o.project.pk, "code": o.project.code, "name": o.project.name} if o.project else None,
            "employee": {"id": o.employee.pk, "name": o.employee.name} if o.employee else None,
            "purpose": o.purpose.name if o.purpose else ("O'tkazma" + (f" · {counter}" if counter else "")),
            "basis": o.basis or o.received_from or o.issued_to,
            "in": o.amount if incoming else ZERO, "out": ZERO if incoming else o.amount,
        })
    other = closing - opening - total_in + total_out
    return {
        "account": {"id": acc.pk, "name": acc.name, "kind": acc.kind, "currency": acc.currency,
                    "cash_limit": acc.cash_limit, "responsible": acc.responsible.name if acc.responsible else ""},
        "date": date, "opening": opening, "rows": rows, "total_in": total_in, "total_out": total_out,
        "other": other, "closing": closing,
        "over_limit": bool(acc.cash_limit is not None and closing > acc.cash_limit),
    }


# ------------------------------------------------------------------ Loyiha and partner


def _customer_orders(project):
    return (posted_orders().filter(project=project, purpose__posting=Posting.PARTNER_CUSTOMER)
            .exclude(kind=OrderKind.TRANSFER))


def _in_project_currency(order: CashOrder, project) -> Decimal:
    """An order's amount in the Loyiha currency at the order's own rate (the contract's USD rate, then the
    day's rate, when a so'm order has to be shown in a USD Loyiha)."""
    if order.currency == project.currency:
        return order.amount
    if order.currency != UZS:  # USD order → so'm Loyiha
        return q2(order.amount * (order.rate or 1))
    rate = project.usd_rate
    if not rate:
        try:
            rate = ledger.rate_for(order.date, project.currency)
        except Exception:  # noqa: BLE001 — no rate anywhere: the so'm amount cannot be converted
            return ZERO
    return q2(order.amount / rate)


def project_advance(project) -> dict | None:
    """Σ posted customer kirim − refunds of the Loyiha, in its currency; None when there is no posted
    customer payment (the advance then stays a typed number)."""
    orders = list(_customer_orders(project).order_by("date", "id"))
    if not orders:
        return None
    total = ZERO
    for o in orders:
        value = _in_project_currency(o, project)
        total += value if o.kind == OrderKind.IN else -value
    return {"amount": max(total, ZERO), "date": orders[0].date}


def project_payments(project) -> dict:
    derived = project_advance(project)
    agg = _customer_orders(project).aggregate(n=Count("id"), last=Max("date"))
    return {"count": agg["n"] or 0, "paid": derived["amount"] if derived else ZERO, "last_date": agg["last"]}


def partner_payments(partner) -> dict:
    qs = posted_orders().filter(partner=partner)
    agg = qs.aggregate(n=Count("id"), last=Max("date"))
    return {"count": agg["n"] or 0, "last_date": agg["last"],
            "paid_in": _uzs_sum(qs.filter(kind=OrderKind.IN)), "paid_out": _uzs_sum(qs.filter(kind=OrderKind.OUT))}


# ------------------------------------------------------------------ invoice cap


def invoice_open(invoice, *, currency: str, rate=None) -> Decimal:
    """What is still open on one invoice, in `currency`: its settlement amount from its own entry (gross
    minus the advance applied at confirmation) minus the posted kassa orders already linked to it."""
    if invoice.entry_id is None:
        return ZERO
    role = "ar_customers" if invoice.kind == InvoiceKind.CUSTOMER else "ap_suppliers"
    acc = ledger.resolve_account(role)
    lines = invoice.entry.lines.filter(account=acc)
    foreign = invoice.currency != UZS
    if invoice.kind == InvoiceKind.CUSTOMER:
        net = lines.aggregate(s=Sum(F("debit") - F("credit")))["s"] or ZERO
        if foreign:
            net = sum(((ln.amount_cur or ZERO) * (1 if ln.debit else -1) for ln in lines), ZERO)
        pay_kind, refund_kind = OrderKind.IN, OrderKind.OUT
    else:
        net = lines.aggregate(s=Sum(F("credit") - F("debit")))["s"] or ZERO
        if foreign:
            net = sum(((ln.amount_cur or ZERO) * (1 if ln.credit else -1) for ln in lines), ZERO)
        pay_kind, refund_kind = OrderKind.OUT, OrderKind.IN
    paid = posted_orders().filter(invoice=invoice, currency=invoice.currency)
    paid_sum = ((paid.filter(kind=pay_kind).aggregate(s=Sum("amount"))["s"] or ZERO)
                - (paid.filter(kind=refund_kind).aggregate(s=Sum("amount"))["s"] or ZERO))
    open_inv = max(net - paid_sum, ZERO)  # in the invoice currency
    if currency == invoice.currency:
        return open_inv
    rate = Decimal(rate or 1)
    if invoice.currency == UZS:  # USD payment for a so'm invoice
        return q2(open_inv / rate) if rate else ZERO
    return q2(open_inv * rate)  # so'm payment for a USD invoice
