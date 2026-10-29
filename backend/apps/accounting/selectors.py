"""Read API of the ledger (ADR 0007: every balance is a sum over posted lines, nothing is stored).

Public contract — other apps (procurement, kassa, projects card) call these and nothing else here:

    rate_for(date, currency) -> Decimal
        UZS → 1. Raises Conflict("Kurs kiritilmagan") when no ExchangeRate exists for that day.
    account_balance(role_or_account, *, on=None, partner=None, project=None, currency=None) -> Decimal
        Σ debit − Σ credit in UZS over live lines (posted entries, minus the reversed pairs), up to `on`.
    account_balance_cur(role_or_account, *, currency, on=None, partner=None, project=None) -> Decimal
        The same, in document currency (Σ signed amount_cur) — for USD balances.
    partner_balance(partner) -> {ar, advance_received, ap, advance_paid, net_uzs, net_cur}
        All positive numbers in their own meaning; net_uzs > 0 = the partner owes Rombo;
        net_cur = {"USD": Decimal} for every foreign currency with a non-zero net.
    project_money(project) -> {invoiced, paid, debt}

`role_or_account` is an Account instance or a role key such as "ap_suppliers".
Reports (trial_balance, account_card, reconciliation) are for the API views of this app.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.apps import apps
from django.db.models import Case, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce

from apps.accounting.models import (
    UZS,
    ZERO,
    Account,
    AccountRole,
    EntryStatus,
    ExchangeRate,
    JournalEntry,
    JournalLine,
    SourceKind,
    q2,
)
from apps.core.exceptions import Conflict

MONEY = DecimalField(max_digits=18, decimal_places=2)
PARTNER_ROLES = ("ar_customers", "advance_received", "ap_suppliers", "advance_paid")


# ------------------------------------------------------------------ roles and rates


def role_account(key: str) -> Account:
    role = AccountRole.objects.select_related("account").filter(key=key).first()
    if role is None:
        raise Conflict(f"Hisob roli sozlanmagan: {key}. Sozlamalar → Hisoblar rejasi → Rollar")
    return role.account


def resolve_account(role_or_account) -> Account:
    if isinstance(role_or_account, Account):
        return role_or_account
    return role_account(str(role_or_account))


def rate_for(date: dt.date, currency: str) -> Decimal:
    if currency == UZS:
        return Decimal("1")
    row = ExchangeRate.objects.filter(date=date, currency=currency).first()
    if row is None:
        raise Conflict(f"Kurs kiritilmagan: {currency} {date:%d.%m.%Y}")
    return row.rate


# ------------------------------------------------------------------ balances


def live_lines():
    """Lines whose entry still counts: posted and not a reversal (a reversed entry and its mirror are a
    pair that cancels — skipping both lets one-sided sums, like 'invoiced', stay right)."""
    return (JournalLine.objects.filter(entry__status=EntryStatus.POSTED)
            .exclude(entry__source_kind=SourceKind.REVERSAL))


def _scoped(qs, *, on=None, partner=None, project=None, currency=None):
    if on is not None:
        qs = qs.filter(date__lte=on)
    if partner is not None:
        qs = qs.filter(partner=partner)
    if project is not None:
        qs = qs.filter(project=project)
    if currency is not None:
        qs = qs.filter(currency=currency)
    return qs


def _signed_sum(qs) -> Decimal:
    agg = qs.aggregate(d=Coalesce(Sum("debit"), Value(ZERO), output_field=MONEY),
                       c=Coalesce(Sum("credit"), Value(ZERO), output_field=MONEY))
    return agg["d"] - agg["c"]


def account_balance(role_or_account, *, on=None, partner=None, project=None, currency=None) -> Decimal:
    account = resolve_account(role_or_account)
    qs = _scoped(live_lines().filter(account=account), on=on, partner=partner, project=project, currency=currency)
    return _signed_sum(qs)


def account_balance_cur(role_or_account, *, currency: str, on=None, partner=None, project=None) -> Decimal:
    if currency == UZS:
        return account_balance(role_or_account, on=on, partner=partner, project=project, currency=UZS)
    account = resolve_account(role_or_account)
    qs = _scoped(live_lines().filter(account=account), on=on, partner=partner, project=project, currency=currency)
    signed = Case(When(debit__gt=0, then=F("amount_cur")), default=-F("amount_cur"), output_field=MONEY)
    return qs.aggregate(s=Coalesce(Sum(signed), Value(ZERO), output_field=MONEY))["s"]


def partner_balance(partner) -> dict:
    ar = account_balance("ar_customers", partner=partner)
    advance_received = -account_balance("advance_received", partner=partner)
    ap = -account_balance("ap_suppliers", partner=partner)
    advance_paid = account_balance("advance_paid", partner=partner)
    accounts = {resolve_account(r) for r in PARTNER_ROLES}
    cur_rows = (live_lines().filter(partner=partner, account__in=accounts).exclude(currency=UZS)
                .values("currency")
                .annotate(s=Sum(Case(When(debit__gt=0, then=F("amount_cur")), default=-F("amount_cur"),
                                     output_field=MONEY))))
    net_cur = {r["currency"]: r["s"] for r in cur_rows if r["s"]}
    return {
        "ar": ar, "advance_received": advance_received, "ap": ap, "advance_paid": advance_paid,
        "net_uzs": ar - advance_received - ap + advance_paid, "net_cur": net_cur,
    }


def project_money(project) -> dict:
    """invoiced = customer invoices on the Loyiha (debits on ar_customers); paid = what the client has
    paid (credits on ar + advances received − advances applied); debt = invoiced − paid."""
    if not AccountRole.objects.filter(key__in=("ar_customers", "advance_received")).exists():
        return {"invoiced": ZERO, "paid": ZERO, "debt": ZERO}  # chart not seeded yet: the card still opens
    ar, adv = resolve_account("ar_customers"), resolve_account("advance_received")
    qs = live_lines().filter(project=project)
    agg = qs.aggregate(
        inv=Coalesce(Sum("debit", filter=Q(account=ar)), Value(ZERO), output_field=MONEY),
        ar_c=Coalesce(Sum("credit", filter=Q(account=ar)), Value(ZERO), output_field=MONEY),
        adv_c=Coalesce(Sum("credit", filter=Q(account=adv)), Value(ZERO), output_field=MONEY),
        adv_d=Coalesce(Sum("debit", filter=Q(account=adv)), Value(ZERO), output_field=MONEY),
    )
    paid = agg["ar_c"] + agg["adv_c"] - agg["adv_d"]
    return {"invoiced": agg["inv"], "paid": paid, "debt": agg["inv"] - paid}


# ------------------------------------------------------------------ reports


def _split(signed: Decimal) -> tuple[Decimal, Decimal]:
    return (signed, ZERO) if signed > 0 else (ZERO, -signed)


def trial_balance(date_from: dt.date | None, date_to: dt.date | None) -> dict:
    """Oborot-saldo vedomost: per posting account opening Dt/Kt, turnover Dt/Kt, closing Dt/Kt."""
    lines = live_lines()
    if date_to is not None:
        lines = lines.filter(date__lte=date_to)
    opening: dict[int, Decimal] = {}
    if date_from is not None:
        for r in (lines.filter(date__lt=date_from).values("account")
                  .annotate(d=Sum("debit"), c=Sum("credit"))):
            opening[r["account"]] = (r["d"] or ZERO) - (r["c"] or ZERO)
        lines = lines.filter(date__gte=date_from)
    turnover = {r["account"]: ((r["d"] or ZERO), (r["c"] or ZERO))
                for r in lines.values("account").annotate(d=Sum("debit"), c=Sum("credit"))}
    ids = set(opening) | set(turnover)
    rows, tot = [], dict.fromkeys(("open_dt", "open_kt", "dt", "kt", "close_dt", "close_kt"), ZERO)
    for acc in Account.objects.filter(pk__in=ids).order_by("code"):
        op = opening.get(acc.pk, ZERO)
        d, c = turnover.get(acc.pk, (ZERO, ZERO))
        open_dt, open_kt = _split(op)
        close_dt, close_kt = _split(op + d - c)
        row = {"account": {"id": acc.pk, "code": acc.code, "name": acc.name, "kind": acc.kind},
               "open_dt": open_dt, "open_kt": open_kt, "dt": d, "kt": c, "close_dt": close_dt, "close_kt": close_kt}
        rows.append(row)
        for k in tot:
            tot[k] += row[k]
    return {"from": date_from, "to": date_to, "rows": rows, "totals": tot}


def _entry_ref(e: JournalEntry) -> dict:
    return {"id": e.pk, "code": e.code, "memo": e.memo, "source_kind": e.source_kind, "status": e.status,
            "source_model": e.source_model, "source_id": e.source_id}


def account_card(account: Account, date_from, date_to, *, partner=None, project=None) -> dict:
    """Hisob kartochkasi: every line of one account in the period (reversals included, so the storno is
    visible) with a running balance that starts from the opening balance."""
    base = _scoped(JournalLine.objects.filter(account=account), partner=partner, project=project)
    opening = _signed_sum(base.filter(date__lt=date_from)) if date_from else ZERO
    qs = base
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)
    qs = qs.select_related("entry", "partner", "project").order_by("date", "entry_id", "id")
    bal, rows, dt_sum, kt_sum = opening, [], ZERO, ZERO
    for ln in qs:
        bal += ln.debit - ln.credit
        dt_sum += ln.debit
        kt_sum += ln.credit
        rows.append({
            "id": ln.pk, "date": ln.date, "entry": _entry_ref(ln.entry), "memo": ln.memo or ln.entry.memo,
            "partner": {"id": ln.partner.pk, "name": ln.partner.name} if ln.partner else None,
            "project": {"id": ln.project.pk, "code": ln.project.code, "name": ln.project.name} if ln.project else None,
            "debit": ln.debit, "credit": ln.credit, "currency": ln.currency, "amount_cur": ln.amount_cur,
            "rate": ln.rate, "balance": bal,
        })
    return {"account": {"id": account.pk, "code": account.code, "name": account.name, "kind": account.kind},
            "from": date_from, "to": date_to, "opening": opening, "rows": rows,
            "turnover_dt": dt_sum, "turnover_kt": kt_sum, "closing": bal}


def document_label(source_model: str, source_id: int | None) -> str:
    """'Hisob-faktura HF-00003' from the generic source reference, resolved at read time (no imports)."""
    if not source_model or not source_id:
        return ""
    try:
        model = apps.get_model(source_model)
    except LookupError:
        return source_model
    obj = model._base_manager.filter(pk=source_id).first()
    if obj is None:
        return f"{model._meta.verbose_name} #{source_id}"
    code = getattr(obj, "code", None)
    return f"{model._meta.verbose_name} {code or f'#{source_id}'}"


def reconciliation(partner, date_from, date_to) -> dict:
    """Solishtirma dalolatnoma from Rombo's side: settlement accounts of one partner. Opening balance,
    one row per document (debits and credits inside one entry netted, so an advance offset does not show
    as two movements), closing balance. Positive balance = the partner owes Rombo."""
    accounts = {resolve_account(r) for r in PARTNER_ROLES}
    base = JournalLine.objects.filter(partner=partner, account__in=accounts)
    opening = _signed_sum(base.filter(date__lt=date_from)) if date_from else ZERO
    qs = base
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)
    per_entry: dict[int, dict] = {}
    for ln in qs.select_related("entry").order_by("date", "entry_id", "id"):
        row = per_entry.get(ln.entry_id)
        if row is None:
            e = ln.entry
            row = per_entry[ln.entry_id] = {
                "date": ln.date, "entry": _entry_ref(e), "document": document_label(e.source_model, e.source_id)
                or (f"Storno {e.reversal_of.code}" if e.source_kind == SourceKind.REVERSAL
                    and hasattr(e, "reversal_of") else f"O'tkazma {e.code}"),
                "memo": e.memo, "dt": ZERO, "kt": ZERO, "currency": ln.currency, "amount_cur": ZERO,
            }
        row["dt"] += ln.debit
        row["kt"] += ln.credit
        if ln.amount_cur is not None:
            row["amount_cur"] += ln.amount_cur if ln.debit else -ln.amount_cur
    rows, bal, dt_sum, kt_sum = [], opening, ZERO, ZERO
    for row in per_entry.values():
        net = row["dt"] - row["kt"]
        row["dt"], row["kt"] = _split(net)
        bal += net
        dt_sum += row["dt"]
        kt_sum += row["kt"]
        row["balance"] = bal
        rows.append(row)
    return {"partner": {"id": partner.pk, "code": partner.code, "name": partner.name, "tin": partner.tin},
            "from": date_from, "to": date_to, "opening": opening, "rows": rows,
            "turnover_dt": dt_sum, "turnover_kt": kt_sum, "closing": bal}


def entry_source_label(entry: JournalEntry) -> str:
    return document_label(entry.source_model, entry.source_id)


def q(value) -> Decimal:
    return q2(value)
