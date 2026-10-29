"""Write API of the ledger (ADR 0007): postings come from documents, entries are immutable, corrections
are reversals, accounts are addressed by roles.

Public contract — procurement and kassa import these; keep names and keyword-only signatures:

    entry_post(*, actor, date, memo, lines, source=None, source_kind="document") -> JournalEntry
        `source` is the document instance (stored as source_model="app.model" + source_id). Each line is a
        dict with {"role": "ap_suppliers"} or {"account": Account}, `debit` / `credit` (Decimal, UZS, exactly
        one non-zero), optional `partner` (clients.Client), `project` (projects.Project), `currency`,
        `amount_cur`, `rate`, `memo`. For a foreign-currency line without `rate` the day's ExchangeRate is
        used (Conflict "Kurs kiritilmagan" when missing). Checks Σ debit = Σ credit (ValidationFailed
        "O'tkazma balanslanmagan"), the lock date (Conflict "Davr yopilgan") and `allow_posting`.
    entry_reverse(entry, *, actor, date=None, memo="") -> JournalEntry
        Posts the mirror entry (source_kind="reversal", dated `date` or the original's date) and marks the
        original "reversed". Conflict when already reversed or when `entry` is itself a reversal.
    check_open(date)
        Conflict("Davr yopilgan") when date <= Company.lock_date.
    advance_offset_lines(*, partner, side, amount, project=None, currency="UZS", rate=None) -> list[dict]
        Lines that apply the partner's advance to a new debt, for min(amount, advance balance):
        side="supplier": Dt ap_suppliers / Kt advance_paid; side="customer": Dt advance_received / Kt
        ar_customers. Empty list when nothing to offset. In a foreign currency `amount` is in that currency,
        `rate` is the document's rate and the exchange difference is included (see settle_lines).
    settle_lines(*, partner, role, side, amount_cur, currency, rate, project=None) -> list[dict]
        Lines that close `amount_cur` of the partner's balance on `role` at its historical UZS value plus
        the exchange difference against `rate` (Dt fx_loss / Kt fx_gain, on the partner). side="debit"
        debits the role (paying a supplier on ap_suppliers, applying advance_received); side="credit"
        credits it (a client paying ar_customers, consuming advance_paid). The caller adds the counter
        line (cash, bank…) at amount_cur × rate. UZS: just the one line.

Everything else here (invoices, chart, rates) is this app's own.
"""

from __future__ import annotations

import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounting import selectors
from apps.accounting.models import (
    UZS,
    ZERO,
    Account,
    AccountRole,
    EntryStatus,
    ExchangeRate,
    Invoice,
    InvoiceKind,
    InvoiceLine,
    InvoiceStatus,
    JournalEntry,
    JournalLine,
    SourceKind,
    q2,
)
from apps.chatter.services import event
from apps.company.models import Company
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.models import assign_code

RATE_Q = Decimal("0.0001")


def _label_of(obj) -> str:
    return f"{obj._meta.app_label}.{obj._meta.model_name}"


# ------------------------------------------------------------------ journal


def check_open(date: dt.date) -> None:
    lock = Company.get().lock_date
    if lock is not None and date <= lock:
        raise Conflict(f"Davr yopilgan: {lock:%d.%m.%Y} gacha o'tkazma qilib bo'lmaydi")


def _line_account(line: dict) -> Account:
    acc = line.get("account")
    if acc is None and line.get("role"):
        acc = selectors.role_account(line["role"])
    if acc is None:
        raise ValidationFailed("Qatorda hisob ko'rsatilmagan", field="lines")
    if not isinstance(acc, Account):
        acc = Account.objects.filter(pk=acc).first()
        if acc is None:
            raise ValidationFailed("Bunday hisob yo'q", field="lines")
    if not acc.allow_posting:
        raise ValidationFailed(f"{acc.code} — guruh hisobi, o'tkazma qilib bo'lmaydi", field="lines")
    if not acc.is_active:
        raise ValidationFailed(f"{acc.code} hisobi nofaol", field="lines")
    return acc


def _build_lines(date: dt.date, lines: list[dict]) -> tuple[list[JournalLine], Decimal, Decimal]:
    if len(lines) < 2:
        raise ValidationFailed("O'tkazmada kamida ikki qator bo'lishi kerak", field="lines")
    rows, total_d, total_c = [], ZERO, ZERO
    for raw in lines:
        debit, credit = q2(raw.get("debit") or 0), q2(raw.get("credit") or 0)
        if (debit > 0) == (credit > 0):
            raise ValidationFailed("Har bir qatorda debet yoki kredit — faqat bittasi, noldan katta", field="lines")
        currency = raw.get("currency") or UZS
        amount_cur, rate = raw.get("amount_cur"), raw.get("rate")
        if currency == UZS:
            amount_cur = rate = None
        else:
            if rate is None:
                rate = selectors.rate_for(date, currency)
            if amount_cur is None:
                amount_cur = q2((debit or credit) / Decimal(rate))
        rows.append(JournalLine(
            date=date, account=_line_account(raw), debit=debit, credit=credit, partner=raw.get("partner"),
            project=raw.get("project"), currency=currency, amount_cur=amount_cur, rate=rate,
            memo=(raw.get("memo") or "")[:300],
        ))
        total_d += debit
        total_c += credit
    if total_d != total_c:
        raise ValidationFailed(f"O'tkazma balanslanmagan: Dt {total_d:f} ≠ Kt {total_c:f}", field="lines")
    return rows, total_d, total_c


@transaction.atomic
def entry_post(*, actor, date, memo, lines, source=None, source_kind="document") -> JournalEntry:
    check_open(date)
    rows, total_d, total_c = _build_lines(date, lines)
    entry = JournalEntry(date=date, memo=(memo or "")[:300], source_kind=source_kind, total_debit=total_d,
                         total_credit=total_c, posted_by=actor if getattr(actor, "pk", None) else None)
    if source is not None:
        entry.source_model, entry.source_id = _label_of(source), source.pk
    entry.stamp(actor, created=True)
    entry.save()
    assign_code(entry, "BX")
    for r in rows:
        r.entry = entry
    JournalLine.objects.bulk_create(rows)
    return entry


@transaction.atomic
def entry_reverse(entry: JournalEntry, *, actor, date=None, memo: str = "") -> JournalEntry:
    entry = JournalEntry.objects.select_for_update().get(pk=entry.pk)
    if entry.status == EntryStatus.REVERSED:
        raise Conflict(f"{entry.code} allaqachon storno qilingan ({entry.reversed_by.code})")
    if entry.source_kind == SourceKind.REVERSAL:
        raise Conflict("Storno o'tkazmasini storno qilib bo'lmaydi — asl o'tkazmani qayta kiriting")
    date = date or entry.date
    mirror_lines = [
        {"account": ln.account, "debit": ln.credit, "credit": ln.debit, "partner": ln.partner, "project": ln.project,
         "currency": ln.currency, "amount_cur": ln.amount_cur, "rate": ln.rate, "memo": ln.memo}
        for ln in entry.lines.select_related("account")
    ]
    mirror = entry_post(actor=actor, date=date, memo=memo or f"Storno {entry.code}", lines=mirror_lines,
                        source_kind=SourceKind.REVERSAL)
    mirror.source_model, mirror.source_id = entry.source_model, entry.source_id  # keep the document link
    mirror.save(update_fields=["source_model", "source_id"])
    entry.status = EntryStatus.REVERSED
    entry.reversed_by = mirror
    entry.stamp(actor)
    entry.save(update_fields=["status", "reversed_by", "updated_by", "updated_at"])
    return mirror


def entry_create_manual(*, actor, date, memo, lines) -> JournalEntry:
    """Opening balances and accountant corrections — the only entries a person types."""
    return entry_post(actor=actor, date=date, memo=memo, lines=lines, source_kind=SourceKind.MANUAL)


# ------------------------------------------------------------------ settlements in currency


def settle_lines(*, partner, role: str, side: str, amount_cur, currency: str, rate=None, project=None) -> list[dict]:
    amount_cur = q2(amount_cur)
    if amount_cur <= 0:
        return []
    base = {"partner": partner, "project": project}
    if currency == UZS:
        return [{"role": role, ("debit" if side == "debit" else "credit"): amount_cur, **base}]
    if rate is None:
        raise Conflict("Kurs kiritilmagan")
    paid = q2(amount_cur * Decimal(rate))
    bal_uzs = selectors.account_balance(role, partner=partner, currency=currency)
    bal_cur = selectors.account_balance_cur(role, currency=currency, partner=partner)
    # what this amount is carried at on the account (average historical rate); nothing carried → no difference
    carried = paid if bal_cur == 0 else q2(abs(bal_uzs) * amount_cur / abs(bal_cur))
    hist_rate = (carried / amount_cur).quantize(RATE_Q, rounding=ROUND_HALF_UP)
    main = {"role": role, ("debit" if side == "debit" else "credit"): carried, "currency": currency,
            "amount_cur": amount_cur, "rate": hist_rate, **base}
    diff = paid - carried
    if diff == 0:
        return [main]
    # liability (side=debit): paying more so'm than carried is a loss; asset (side=credit): receiving more is a gain
    loss = diff > 0 if side == "debit" else diff < 0
    fx = ({"role": "fx_loss", "debit": abs(diff), "memo": "Kurs farqi", **base} if loss
          else {"role": "fx_gain", "credit": abs(diff), "memo": "Kurs farqi", **base})
    return [main, fx]


def advance_offset_lines(*, partner, side: str, amount, project=None, currency: str = UZS, rate=None) -> list[dict]:
    if side == "supplier":
        adv_role, main_role, adv_debit_normal = "advance_paid", "ap_suppliers", True
    elif side == "customer":
        adv_role, main_role, adv_debit_normal = "advance_received", "ar_customers", False
    else:
        raise ValueError("side must be 'supplier' or 'customer'")
    amount = q2(amount)
    if amount <= 0:
        return []
    sign = 1 if adv_debit_normal else -1
    if currency == UZS:
        available = sign * selectors.account_balance(adv_role, partner=partner, currency=UZS)
    else:
        if rate is None:
            raise Conflict("Kurs kiritilmagan")
        available = sign * selectors.account_balance_cur(adv_role, currency=currency, partner=partner)
    offset = min(amount, available)
    if offset <= 0:
        return []
    base = {"partner": partner, "project": project, "memo": "Avans hisobga olindi"}
    main_side = "debit" if side == "supplier" else "credit"  # Dt ap_suppliers … / … Kt ar_customers
    adv_lines = settle_lines(partner=partner, role=adv_role, side="credit" if side == "supplier" else "debit",
                             amount_cur=offset, currency=currency, rate=rate, project=project)
    for ln in adv_lines:
        ln.setdefault("memo", base["memo"])
    main = {"role": main_role, main_side: q2(offset * Decimal(rate)) if currency != UZS else offset, **base}
    if currency != UZS:
        main.update(currency=currency, amount_cur=offset, rate=Decimal(rate))
    return [main, *adv_lines]


# ------------------------------------------------------------------ chart of accounts, roles, rates


@transaction.atomic
def account_create(*, actor, **fields) -> Account:
    if Account.objects.filter(code=fields.get("code")).exists():
        raise Conflict("Bu kodli hisob bor", field="code")
    acc = Account(**fields)
    acc.stamp(actor, created=True)
    acc.save()
    return acc


@transaction.atomic
def account_update(acc: Account, *, actor, **fields) -> Account:
    new_code = fields.get("code")
    if new_code and new_code != acc.code and Account.objects.filter(code=new_code).exists():
        raise Conflict("Bu kodli hisob bor", field="code")
    if fields.get("parent") is not None and fields["parent"].pk == acc.pk:
        raise ValidationFailed("Hisob o'zining guruhi bo'la olmaydi", field="parent_id")
    if fields.get("allow_posting") is False and acc.lines.exists():
        raise Conflict("Hisobda o'tkazmalar bor — guruh hisobiga aylantirib bo'lmaydi")
    for k, v in fields.items():
        setattr(acc, k, v)
    acc.stamp(actor)
    acc.save()
    return acc


def account_delete(acc: Account, *, actor) -> None:
    if acc.lines.exists():
        raise Conflict("Hisobda o'tkazmalar bor — o'chirish o'rniga nofaol qiling")
    if acc.children.exists():
        raise Conflict("Hisobning ichki hisoblari bor")
    if acc.roles.exists():
        raise Conflict("Hisob rolga biriktirilgan — avval rolni boshqa hisobga o'tkazing")
    acc.delete()


@transaction.atomic
def role_set(role: AccountRole, *, actor, account: Account) -> AccountRole:
    if not account.allow_posting:
        raise ValidationFailed("Rolga faqat o'tkazma qilinadigan hisob biriktiriladi", field="account_id")
    if role.account_id != account.pk:
        old = role.account
        role.account = account
        role.save(update_fields=["account"])
        event(account, f"Rol biriktirildi: {role.key} ({old.code} → {account.code})", actor=actor)
    return role


@transaction.atomic
def rate_set(*, actor=None, date, currency, rate, source: str = "manual") -> ExchangeRate:
    if currency == UZS:
        raise ValidationFailed("So'm uchun kurs kiritilmaydi", field="currency")
    row, _ = ExchangeRate.objects.update_or_create(date=date, currency=currency,
                                                   defaults={"rate": Decimal(rate), "source": source})
    return row


def rate_delete(row: ExchangeRate, *, actor) -> None:
    row.delete()


# ------------------------------------------------------------------ invoices


def _default_role(kind: str) -> str:
    return "revenue_products" if kind == InvoiceKind.CUSTOMER else "admin_expense"


def _apply_lines(inv: Invoice, lines: list[dict]) -> None:
    company = Company.get()
    inv.lines.all().delete()
    rows = []
    for i, ln in enumerate(lines):
        vat = ln.get("vat_rate")
        vat = ZERO if not company.vat_payer else (company.vat_rate if vat is None else Decimal(vat))
        role = ln.get("role") or _default_role(inv.kind)
        selectors.role_account(role)  # must exist
        rows.append(InvoiceLine(invoice=inv, sort_order=(i + 1) * 10, name=ln["name"][:300],
                                unit=ln.get("unit") or "dona", qty=ln["qty"], price=ln["price"], vat_rate=vat,
                                role=role))
    InvoiceLine.objects.bulk_create(rows)
    inv.recalc()
    inv.save(update_fields=["net", "vat", "gross", "updated_at"])


def _check_draft(inv: Invoice) -> None:
    if inv.status != InvoiceStatus.DRAFT:
        raise Conflict(f"Hisob-faktura «{InvoiceStatus(inv.status).label}» — faqat qoralamani o'zgartirish mumkin")


@transaction.atomic
def invoice_create(*, actor, lines: list[dict] | None = None, **fields) -> Invoice:
    inv = Invoice(**fields)
    if inv.date is None:
        inv.date = timezone.localdate()
    inv.stamp(actor, created=True)
    inv.save()
    assign_code(inv, "HF")
    _apply_lines(inv, lines or [])
    return inv


@transaction.atomic
def invoice_update(inv: Invoice, *, actor, lines: list[dict] | None = None, **fields) -> Invoice:
    _check_draft(inv)
    for k, v in fields.items():
        setattr(inv, k, v)
    inv.stamp(actor)
    inv.save()
    if lines is not None:
        _apply_lines(inv, lines)
    return inv


def invoice_delete(inv: Invoice, *, actor) -> None:
    if inv.status != InvoiceStatus.DRAFT:
        raise Conflict("Faqat qoralama hisob-fakturani o'chirish mumkin. Tasdiqlanganini bekor qiling.")
    inv.soft_delete()


@transaction.atomic
def invoice_confirm(inv: Invoice, *, actor) -> Invoice:
    inv = Invoice.objects.select_for_update().select_related("partner", "project").get(pk=inv.pk)
    if inv.status != InvoiceStatus.DRAFT:
        raise Conflict(f"Hisob-faktura allaqachon «{InvoiceStatus(inv.status).label}»")
    lines = list(inv.lines.all())
    if not lines:
        raise ValidationFailed("Hisob-fakturada qator yo'q", field="lines")
    check_open(inv.date)
    company = Company.get()
    if not company.vat_payer and any(ln.vat_rate for ln in lines):  # VAT switched off after the draft was typed
        for ln in lines:
            ln.vat_rate = ZERO
            ln.save(update_fields=["vat_rate"])
        inv.recalc()
    foreign = inv.currency != UZS
    rate = (inv.rate or selectors.rate_for(inv.date, inv.currency)) if foreign else None

    def uzs(amount: Decimal) -> Decimal:
        return q2(amount * rate) if foreign else amount

    def cur(amount: Decimal) -> dict:
        return {"currency": inv.currency, "amount_cur": amount, "rate": rate} if foreign else {}

    partner_base = {"partner": inv.partner, "project": inv.project}
    memo = f"Hisob-faktura {inv.code}"
    entry_lines: list[dict] = []
    if inv.kind == InvoiceKind.CUSTOMER:
        for ln in lines:
            entry_lines.append({"role": ln.role or _default_role(inv.kind), "credit": uzs(ln.net),
                                "project": inv.project, "memo": ln.name, **cur(ln.net)})
        if inv.vat > 0:
            entry_lines.append({"role": "vat_output", "credit": uzs(inv.vat), "memo": "QQS", **cur(inv.vat)})
        gross_uzs = sum((ln["credit"] for ln in entry_lines), ZERO)  # Σ of the rounded parts, so it balances
        entry_lines.insert(0, {"role": "ar_customers", "debit": gross_uzs, **partner_base, "memo": memo,
                               **cur(inv.gross)})
        side = "customer"
    else:
        for ln in lines:
            entry_lines.append({"role": ln.role or _default_role(inv.kind), "debit": uzs(ln.net),
                                "project": inv.project, "memo": ln.name, **cur(ln.net)})
        if inv.vat > 0:
            entry_lines.append({"role": "vat_input", "debit": uzs(inv.vat), "memo": "QQS", **cur(inv.vat)})
        gross_uzs = sum((ln["debit"] for ln in entry_lines), ZERO)
        entry_lines.append({"role": "ap_suppliers", "credit": gross_uzs, **partner_base, "memo": memo,
                            **cur(inv.gross)})
        side = "supplier"
    offset = advance_offset_lines(partner=inv.partner, side=side, amount=inv.gross if foreign else gross_uzs,
                                  project=inv.project, currency=inv.currency, rate=rate)
    entry = entry_post(actor=actor, date=inv.date, memo=f"{memo} · {inv.partner.name}",
                       lines=[*entry_lines, *offset], source=inv)
    inv.entry, inv.status, inv.rate = entry, InvoiceStatus.CONFIRMED, rate
    inv.stamp(actor)
    inv.save()  # tracked: "Holat: Qoralama → Tasdiqlangan"
    event(inv, f"O'tkazma {entry.code}: Dt/Kt {entry.total_debit:f}" + (" · avans hisobga olindi" if offset else ""),
          actor=actor)
    return inv


@transaction.atomic
def invoice_cancel(inv: Invoice, *, actor, date=None) -> Invoice:
    inv = Invoice.objects.select_for_update().get(pk=inv.pk)
    if inv.status == InvoiceStatus.CANCELLED:
        raise Conflict("Hisob-faktura allaqachon bekor qilingan")
    if inv.status != InvoiceStatus.CONFIRMED:
        raise Conflict("Qoralama bekor qilinmaydi — uni o'chiring")
    if inv.entry_id and inv.entry.status == EntryStatus.POSTED:
        mirror = entry_reverse(inv.entry, actor=actor, date=date, memo=f"Storno {inv.entry.code} · {inv.code}")
        event(inv, f"O'tkazma storno qilindi: {mirror.code}", actor=actor)
    inv.status = InvoiceStatus.CANCELLED
    inv.stamp(actor)
    inv.save()
    return inv


@transaction.atomic
def invoice_from_project(project, *, actor) -> Invoice:
    """Draft customer invoice of a Loyiha: one line per order line, the amount split by area, or one line at
    the order amount; services as a separate line. The accountant edits and confirms."""
    company = Company.get()
    vat = company.vat_rate if company.vat_payer else ZERO
    divisor = 1 + vat / 100  # the Loyiha amount is what the client pays — VAT included when Rombo is a payer
    items = list(project.items.select_related("product_type"))
    lines: list[dict] = []
    if items and project.amount > 0:
        weights = [it.area_m2 * it.quantity for it in items]
        total_w = sum(weights, ZERO)
        left = project.amount
        for i, (it, w) in enumerate(zip(items, weights, strict=True)):
            share = left if i == len(items) - 1 else q2(project.amount * w / total_w)
            left -= share
            lines.append({"name": f"{it.product_type.name} {it.area_m2.normalize():f} m² × {it.quantity}",
                          "unit": "dona", "qty": Decimal(it.quantity),
                          "price": q2(share / it.quantity / divisor), "vat_rate": vat})
    elif project.amount > 0:
        lines.append({"name": f"Loyiha {project.code} bo'yicha mahsulot", "unit": "dona", "qty": Decimal("1"),
                      "price": q2(project.amount / divisor), "vat_rate": vat})
    if project.service_amount > 0:
        lines.append({"name": "Xizmatlar (o'rnatish, yetkazib berish)", "unit": "xizmat", "qty": Decimal("1"),
                      "price": q2(project.service_amount / divisor), "vat_rate": vat, "role": "revenue_services"})
    inv = invoice_create(actor=actor, lines=lines, kind=InvoiceKind.CUSTOMER, partner=project.client,
                         project=project, date=timezone.localdate(), currency=project.currency,
                         rate=project.usd_rate if project.currency != UZS else None,
                         notes=f"Loyiha {project.code} — {project.name}"[:500])
    event(project, f"Hisob-faktura yaratildi: {inv.code}", actor=actor)
    return inv
