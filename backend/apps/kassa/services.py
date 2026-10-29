"""Writes of the kassa. Posting rules (design.md / specs/kassa/spec.md):

    partner_customer  kirim: Dt cash · Kt ar_customers up to the receivable (or the invoice's open amount)
                             · Kt advance_received for the rest
                      chiqim (refund): Dt advance_received (then ar_customers) · Kt cash
    partner_supplier  chiqim: Dt ap_suppliers up to the payable (or the invoice) · Dt advance_paid · Kt cash
                      kirim (refund): Dt cash · Kt advance_paid (then ap_suppliers)
    account           kirim: Dt cash · Kt <role>;  chiqim: Dt <role> · Kt cash
    transfer          Dt to-account · Kt from-account

Everything goes through accounting.services.entry_post / entry_reverse; nothing here touches JournalLine.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounting import selectors as ledger
from apps.accounting import services as ledger_services
from apps.accounting.models import Account, EntryStatus
from apps.chatter.services import event
from apps.core.exceptions import Conflict, ValidationFailed
from apps.kassa import selectors
from apps.kassa.models import (
    UZS,
    ZERO,
    CashAccount,
    CashOrder,
    CodeSequence,
    Direction,
    OrderKind,
    OrderStatus,
    PaymentPurpose,
    Posting,
    fmt_money,
    q2,
)
from apps.kassa.seed import default_role

# ------------------------------------------------------------------ accounts


def _check_ledger_account(acc: Account, kind: str, exclude_pk=None) -> None:
    if not acc.allow_posting or not acc.is_active:
        raise ValidationFailed("Faqat o'tkazma qilinadigan faol hisob", field="account_id")
    if not acc.code.startswith("5"):
        raise ValidationFailed("Kassa uchun 5xxx (pul mablag'lari) hisobi kerak", field="account_id")
    taken = CashAccount.objects.filter(account=acc).exclude(pk=exclude_pk).first()
    if taken is not None:
        raise ValidationFailed(f"Bu hisob «{taken.name}» ga biriktirilgan — har bir kassaning o'z hisobi bo'ladi",
                               field="account_id")


@transaction.atomic
def cash_account_create(*, actor, **fields) -> CashAccount:
    acc = fields.get("account")
    if acc is None:
        acc = fields["account"] = ledger.role_account(default_role(fields.get("kind", "cash"),
                                                                   fields.get("currency", UZS)))
    _check_ledger_account(acc, fields.get("kind", "cash"))
    row = CashAccount(**fields)
    row.stamp(actor, created=True)
    row.save()
    return row


@transaction.atomic
def cash_account_update(row: CashAccount, *, actor, **fields) -> CashAccount:
    has_orders = row.orders.exists() or row.incoming_transfers.exists()
    if has_orders:
        for f in ("currency", "account"):
            if f in fields and fields[f] != getattr(row, f):
                raise Conflict("Kassada orderlar bor — valyuta va hisobni o'zgartirib bo'lmaydi")
    if "account" in fields and fields["account"] is not None and fields["account"] != row.account:
        _check_ledger_account(fields["account"], fields.get("kind", row.kind), exclude_pk=row.pk)
    for k, v in fields.items():
        if k == "account" and v is None:
            continue
        setattr(row, k, v)
    row.stamp(actor)
    row.save()
    return row


def cash_account_delete(row: CashAccount, *, actor) -> None:
    if row.orders.exists() or row.incoming_transfers.exists():
        raise Conflict("Kassada orderlar bor — o'chirish o'rniga nofaol qiling")
    row.delete()


# ------------------------------------------------------------------ purposes


@transaction.atomic
def purpose_create(*, actor, **fields) -> PaymentPurpose:
    _check_purpose(fields)
    return PaymentPurpose.objects.create(**fields)


@transaction.atomic
def purpose_update(purpose: PaymentPurpose, *, actor, **fields) -> PaymentPurpose:
    merged = {**{f: getattr(purpose, f) for f in ("posting", "account_role")}, **fields}
    _check_purpose(merged)
    for k, v in fields.items():
        setattr(purpose, k, v)
    purpose.save()
    return purpose


def purpose_delete(purpose: PaymentPurpose, *, actor) -> None:
    if purpose.orders.exists():
        raise Conflict("Maqsad orderlarda ishlatilgan — o'chirish o'rniga nofaol qiling")
    purpose.delete()


def _check_purpose(fields: dict) -> None:
    if fields.get("posting") == Posting.ACCOUNT:
        if not fields.get("account_role"):
            raise ValidationFailed("Hisob rolini ko'rsating", field="account_role")
        ledger.role_account(fields["account_role"])  # must exist
    else:
        fields["account_role"] = ""
        fields["requires_partner"] = True


# ------------------------------------------------------------------ orders: draft


def _check_draft(order: CashOrder) -> None:
    if order.status != OrderStatus.DRAFT:
        raise Conflict(f"Order «{OrderStatus(order.status).label}» — faqat qoralamani o'zgartirish mumkin; "
                       f"xato bo'lsa bekor qiling va yangi order kiriting")


def _check_shape(order: CashOrder) -> None:
    """Field rules that hold for a draft too: kind vs purpose, transfer accounts."""
    if order.kind == OrderKind.TRANSFER:
        if order.to_account_id is None:
            raise ValidationFailed("Qaysi hisobga o'tkazilishini tanlang", field="to_account_id")
        if order.to_account_id == order.account_id:
            raise ValidationFailed("O'sha hisobning o'ziga o'tkazib bo'lmaydi", field="to_account_id")
        if order.to_account.currency != order.account.currency:
            raise ValidationFailed("Valyutalar har xil — bunday o'tkazma ikki order bilan (5710 orqali) qilinadi",
                                   field="to_account_id")
        order.purpose = None
        order.account_role = ""
    else:
        order.to_account = None
        if order.purpose is not None:
            d = order.purpose.direction
            if d != Direction.BOTH and d != order.kind:
                raise ValidationFailed(f"«{order.purpose.name}» — {Direction(d).label} uchun", field="purpose_id")
    if order.account_role and order.purpose is not None and order.purpose.posting == Posting.ACCOUNT:
        ledger.role_account(order.account_role)
    else:
        order.account_role = ""
    if order.invoice_id is not None:
        inv = order.invoice
        if order.partner_id is None:
            order.partner = inv.partner
        elif inv.partner_id != order.partner_id:
            raise ValidationFailed("Hisob-faktura boshqa kontragentniki", field="invoice_id")
        if order.project_id is None and inv.project_id is not None:
            order.project = inv.project
    if order.project_id is not None and order.partner_id is None and order.purpose is not None \
            and order.purpose.posting == Posting.PARTNER_CUSTOMER:
        order.partner = order.project.client


@transaction.atomic
def cash_order_create(*, actor, **fields) -> CashOrder:
    order = CashOrder(**fields)
    if order.date is None:
        order.date = timezone.localdate()
    order.currency = order.account.currency
    _check_shape(order)
    order.stamp(actor, created=True)
    order.save()
    return order


@transaction.atomic
def cash_order_update(order: CashOrder, *, actor, **fields) -> CashOrder:
    _check_draft(order)
    for k, v in fields.items():
        setattr(order, k, v)
    order.currency = order.account.currency
    _check_shape(order)
    order.stamp(actor)
    order.save()  # tracked fields go to chatter
    return order


def cash_order_delete(order: CashOrder, *, actor) -> None:
    if order.status != OrderStatus.DRAFT:
        raise Conflict("Faqat qoralama orderni o'chirish mumkin. O'tkazilganini bekor qiling.")
    order.soft_delete()


# ------------------------------------------------------------------ orders: post


def _next_code(prefix: str) -> str:
    seq, _ = CodeSequence.objects.select_for_update().get_or_create(prefix=prefix)
    seq.last += 1
    seq.save(update_fields=["last"])
    return f"{prefix}-{seq.last:05d}"


def _not_enough(acc: CashAccount, balance: Decimal) -> Conflict:
    unit = "" if acc.currency == UZS else f" {acc.currency}"
    return Conflict(f"Kassada mablag' yetarli emas: qoldiq {fmt_money(balance)}{unit}", field="amount")


def _lock_accounts(order: CashOrder) -> tuple[CashAccount, CashAccount | None]:
    ids = [order.account_id] + ([order.to_account_id] if order.to_account_id else [])
    locked = {a.pk: a for a in CashAccount.objects.select_for_update().select_related("account").filter(pk__in=ids)}
    return locked[order.account_id], locked.get(order.to_account_id)


def _partner_open(order: CashOrder, role: str, *, sign: int, rate) -> Decimal:
    """How much of `role` the partner can settle with this order, in the order currency: the partner's
    balance (positive in its own meaning) capped by the chosen invoice's open amount."""
    partner, cur = order.partner, order.currency
    if cur == UZS:
        balance = sign * ledger.account_balance(role, partner=partner)
    else:
        balance = sign * ledger.account_balance_cur(role, currency=cur, partner=partner)
    balance = max(balance, ZERO)
    if order.invoice_id is not None:
        balance = min(balance, selectors.invoice_open(order.invoice, currency=cur, rate=rate))
    return min(balance, order.amount)


def _posting_lines(order: CashOrder, acc: CashAccount, to_acc: CashAccount | None, rate) -> list[dict]:
    foreign = order.currency != UZS
    base = {"partner": order.partner, "project": order.project}

    def uzs(amount: Decimal) -> Decimal:
        return q2(amount * rate) if foreign else q2(amount)

    def cur(amount: Decimal) -> dict:
        return {"currency": order.currency, "amount_cur": q2(amount), "rate": rate} if foreign else {}

    def settle(role: str, side: str, amount: Decimal) -> list[dict]:
        return ledger_services.settle_lines(partner=order.partner, role=role, side=side, amount_cur=amount,
                                            currency=order.currency, rate=rate if foreign else None,
                                            project=order.project)

    total = order.amount
    memo = order.basis or (order.purpose.name if order.purpose else "")
    if order.kind == OrderKind.TRANSFER:
        return [{"account": to_acc.account, "debit": uzs(total), **cur(total), "memo": f"{acc.name} → {to_acc.name}"},
                {"account": acc.account, "credit": uzs(total), **cur(total), "memo": f"{acc.name} → {to_acc.name}"}]

    cash_side = "debit" if order.kind == OrderKind.IN else "credit"
    cash_line = {"account": acc.account, cash_side: uzs(total), **cur(total), "memo": memo,
                 "project": order.project}
    posting = order.purpose.posting
    if posting == Posting.ACCOUNT:
        role = order.account_role or order.purpose.account_role
        other = "credit" if order.kind == OrderKind.IN else "debit"
        who = order.employee.name if order.employee else ""
        return [cash_line, {"role": role, other: uzs(total), **cur(total), **base,
                            "memo": f"{memo} · {who}" if who else memo}]

    if posting == Posting.PARTNER_CUSTOMER:
        if order.kind == OrderKind.IN:  # client pays: close the receivable first, the rest is an advance
            on_ar = _partner_open(order, "ar_customers", sign=1, rate=rate)
            lines = settle("ar_customers", "credit", on_ar) if on_ar > 0 else []
            rest = total - on_ar
            if rest > 0:
                lines.append({"role": "advance_received", "credit": uzs(rest), **cur(rest), **base, "memo": "Avans"})
        else:  # refund to the client: give back the advance first, then reduce what they owe us
            on_adv = _partner_open(order, "advance_received", sign=-1, rate=rate)
            lines = settle("advance_received", "debit", on_adv) if on_adv > 0 else []
            rest = total - on_adv
            if rest > 0:
                lines.append({"role": "ar_customers", "debit": uzs(rest), **cur(rest), **base, "memo": "Qaytarish"})
        return [cash_line, *lines]

    # partner_supplier
    if order.kind == OrderKind.OUT:  # pay the supplier: close the payable first, the rest is a prepayment
        on_ap = _partner_open(order, "ap_suppliers", sign=-1, rate=rate)
        lines = settle("ap_suppliers", "debit", on_ap) if on_ap > 0 else []
        rest = total - on_ap
        if rest > 0:
            lines.append({"role": "advance_paid", "debit": uzs(rest), **cur(rest), **base, "memo": "Oldindan to'lov"})
    else:  # refund from the supplier: take back the prepayment first, then the payable grows back
        on_adv = _partner_open(order, "advance_paid", sign=1, rate=rate)
        lines = settle("advance_paid", "credit", on_adv) if on_adv > 0 else []
        rest = total - on_adv
        if rest > 0:
            lines.append({"role": "ap_suppliers", "credit": uzs(rest), **cur(rest), **base, "memo": "Qaytarish"})
    return [cash_line, *lines]


def _check_required(order: CashOrder) -> None:
    if order.kind != OrderKind.TRANSFER:
        if order.purpose is None:
            raise ValidationFailed("To'lov maqsadini tanlang", field="purpose_id")
        if not order.purpose.is_active:
            raise ValidationFailed(f"«{order.purpose.name}» nofaol", field="purpose_id")
        needs_partner = order.purpose.requires_partner or order.purpose.posting != Posting.ACCOUNT
        if needs_partner and order.partner_id is None:
            raise ValidationFailed("Kontragentni tanlang", field="partner")
        if order.purpose.requires_employee and order.employee_id is None:
            raise ValidationFailed("Xodimni tanlang", field="employee")
    if order.amount is None or order.amount <= 0:
        raise ValidationFailed("Summa noldan katta bo'lsin", field="amount")


def _sync_project_advance(order: CashOrder, *, actor) -> None:
    if order.project_id is None or order.kind == OrderKind.TRANSFER:
        return
    from apps.projects.services import recompute_advance

    recompute_advance(order.project)


@transaction.atomic
def cash_order_post(order: CashOrder, *, actor) -> CashOrder:
    order = (CashOrder.objects.select_for_update()
             .select_related("account", "to_account", "purpose", "partner", "project", "employee", "invoice")
             .get(pk=order.pk))
    if order.status != OrderStatus.DRAFT:
        raise Conflict(f"Order allaqachon «{OrderStatus(order.status).label}»")
    _check_shape(order)
    _check_required(order)
    ledger_services.check_open(order.date)
    acc, to_acc = _lock_accounts(order)
    if not acc.is_active or (to_acc is not None and not to_acc.is_active):
        raise Conflict("Kassa nofaol")
    order.currency = acc.currency
    rate = None
    if order.currency != UZS:
        rate = Decimal(order.rate) if order.rate else ledger.rate_for(order.date, order.currency)
    if order.kind in (OrderKind.OUT, OrderKind.TRANSFER):
        balance = selectors.account_balance(acc)
        if balance < order.amount:
            raise _not_enough(acc, balance)
    order.code = _next_code(order.prefix)
    lines = _posting_lines(order, acc, to_acc, rate)
    who = order.partner.name if order.partner else order.employee.name if order.employee else ""
    memo = " · ".join(p for p in (order.code, order.purpose.name if order.purpose else "O'tkazma", who) if p)
    entry = ledger_services.entry_post(actor=actor, date=order.date, memo=memo, lines=lines, source=order)
    order.entry, order.rate, order.status = entry, rate, OrderStatus.POSTED
    order.posted_at, order.posted_by = timezone.now(), actor if getattr(actor, "pk", None) else None
    order.stamp(actor)
    order.save()  # tracked: "Holat: Qoralama → O'tkazilgan"
    event(order, f"O'tkazma {entry.code}: {fmt_money(entry.total_debit)} so'm", actor=actor)
    if order.project_id is not None and order.kind != OrderKind.TRANSFER:
        verb = "To'lov" if order.kind == OrderKind.IN else "Chiqim"
        unit = "so'm" if order.currency == UZS else order.currency
        event(order.project, f"{verb} {order.code}: {fmt_money(order.amount)} {unit}", actor=actor)
    _sync_project_advance(order, actor=actor)
    return order


@transaction.atomic
def cash_order_cancel(order: CashOrder, *, actor, comment: str = "", date: dt.date | None = None) -> CashOrder:
    order = (CashOrder.objects.select_for_update()
             .select_related("account", "to_account", "entry", "project").get(pk=order.pk))
    if order.status == OrderStatus.CANCELLED:
        raise Conflict("Order allaqachon bekor qilingan")
    if order.status != OrderStatus.POSTED:
        raise Conflict("Qoralama bekor qilinmaydi — uni o'chiring")
    comment = (comment or "").strip()
    if not comment:
        raise ValidationFailed("Bekor qilish sababini yozing", field="comment")
    acc, to_acc = _lock_accounts(order)
    # reversing a kirim (or a transfer) takes money back out: the account must still hold it
    if order.kind == OrderKind.IN:
        balance = selectors.account_balance(acc)
        if balance < order.amount:
            raise _not_enough(acc, balance)
    elif order.kind == OrderKind.TRANSFER:
        balance = selectors.account_balance(to_acc)
        if balance < order.amount:
            raise _not_enough(to_acc, balance)
    if order.entry_id and order.entry.status == EntryStatus.POSTED:
        mirror = ledger_services.entry_reverse(order.entry, actor=actor, date=date,
                                               memo=f"Storno {order.entry.code} · {order.code}")
        event(order, f"O'tkazma storno qilindi: {mirror.code}", actor=actor)
    order.status = OrderStatus.CANCELLED
    order.stamp(actor)
    order.save()
    event(order, f"Bekor qilindi: {comment}", actor=actor)
    if order.project_id is not None and order.kind != OrderKind.TRANSFER:
        event(order.project, f"To'lov {order.code} bekor qilindi: {comment}", actor=actor)
    _sync_project_advance(order, actor=actor)
    return order
