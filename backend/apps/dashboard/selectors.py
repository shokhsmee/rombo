"""Bosh sahifa analytics (add-dashboard-analytics). Read-only: every number comes from the selectors and
tables of the apps it summarises; nothing here writes and no app imports this module.

Each section is `{"key", "title", "kpis": [...], "series": {...}, "lists": {...}}`. Money is UZS as a
string; months are "YYYY-MM", oldest first.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncMonth

from apps.access.registry import Action, Pages
from apps.access.services import has_permission

ZERO = Decimal("0")
MONEY = DecimalField(max_digits=18, decimal_places=2)


def _s(v) -> str:
    return str((v or ZERO).quantize(Decimal("0.01")))


def months_back(n: int = 12, today: dt.date | None = None) -> list[dt.date]:
    """First days of the last `n` months, oldest first, ending with the current month."""
    today = today or dt.date.today()
    y, m = today.year, today.month
    out = []
    for _ in range(n):
        out.append(dt.date(y, m, 1))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out[::-1]


def _key(d) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _by_month(qs, date_field: str, **aggs) -> dict[str, dict]:
    """{"2026-10": {agg: value}} for the rows of `qs` (already limited to the window)."""
    rows = qs.annotate(_m=TruncMonth(date_field)).values("_m").annotate(**aggs).order_by("_m")
    return {_key(r["_m"]): r for r in rows if r["_m"] is not None}


def _series(
    months: list[dt.date], data: dict[str, dict], fields: list[str], money: bool = True
) -> list[dict]:
    out = []
    for d in months:
        row = data.get(_key(d), {})
        item = {"month": _key(d)}
        for f in fields:
            v = row.get(f) or 0
            item[f] = _s(v) if money else int(v)
        out.append(item)
    return out


def kpi(
    key: str,
    label: str,
    value,
    *,
    unit: str = "so'm",
    link: str | None = None,
    hint: str = "",
    tone: str = "",
) -> dict:
    if isinstance(value, Decimal):
        value = _s(value)
    return {
        "key": key,
        "label": label,
        "value": value,
        "unit": unit,
        "link": link,
        "hint": hint,
        "tone": tone,
    }


# ------------------------------------------------------------------ ledger helpers


def _ledger_ok() -> bool:
    from apps.accounting.models import AccountRole

    return AccountRole.objects.exists()


def _balance(role: str, **kw) -> Decimal:
    from apps.accounting import selectors as ledger
    from apps.core.exceptions import Conflict

    try:
        return ledger.account_balance(role, **kw)
    except Conflict:
        return ZERO


def _role_month(roles: list[str], since: dt.date, sign: int) -> dict[str, Decimal]:
    """Monthly turnover of the accounts behind `roles`: sign=+1 debit − credit, −1 credit − debit."""
    from apps.accounting import selectors as ledger
    from apps.accounting.models import AccountRole

    accounts = list(AccountRole.objects.filter(key__in=roles).values_list("account_id", flat=True))
    qs = ledger.live_lines().filter(account_id__in=accounts, date__gte=since)
    rows = _by_month(
        qs,
        "date",
        d=Coalesce(Sum("debit"), Value(ZERO), output_field=MONEY),
        c=Coalesce(Sum("credit"), Value(ZERO), output_field=MONEY),
    )
    return {k: (r["d"] - r["c"]) * sign for k, r in rows.items()}


# ------------------------------------------------------------------ sections


def _project_uzs(p) -> Decimal:
    total = p.amount + p.service_amount
    if p.currency == "UZS":
        return total
    return total * (p.usd_rate or _usd_rate())


_RATE_CACHE: dict[str, Decimal] = {}


def _usd_rate() -> Decimal:
    if "USD" not in _RATE_CACHE:
        from apps.accounting.models import ExchangeRate

        row = ExchangeRate.objects.filter(currency="USD").order_by("-date").first()
        _RATE_CACHE["USD"] = row.rate if row else ZERO
    return _RATE_CACHE["USD"]


def sales(months: list[dt.date], today: dt.date) -> dict:
    from apps.projects.models import Project
    from apps.projects.models import ProjectStatus as PS

    active = [PS.CONFIRMED, PS.PROCUREMENT, PS.PRODUCTION, PS.READY]
    month_start = today.replace(day=1)
    live = list(Project.objects.filter(status__in=active))
    pipeline = sum((_project_uzs(p) for p in live), ZERO)
    overdue = Project.objects.filter(status__in=active, deadline__lt=today).count()
    signed = Project.objects.exclude(status__in=[PS.DRAFT, PS.CANCELLED]).exclude(sale_date__isnull=True)
    window = list(
        signed.filter(sale_date__gte=months[0]).only(
            "sale_date", "amount", "service_amount", "currency", "usd_rate"
        )
    )
    by_month: dict[str, dict] = {}
    for p in window:
        cell = by_month.setdefault(_key(p.sale_date), {"amount": ZERO, "count": 0})
        cell["amount"] += _project_uzs(p)
        cell["count"] += 1
    this = by_month.get(_key(month_start), {"amount": ZERO, "count": 0})
    statuses = {r["status"]: r["n"] for r in Project.objects.values("status").annotate(n=Count("id"))}
    clients: dict[int, dict] = {}
    for p in Project.objects.exclude(status=PS.CANCELLED).select_related("client"):
        c = clients.setdefault(
            p.client_id, {"id": p.client_id, "name": p.client.name, "amount": ZERO, "count": 0}
        )
        c["amount"] += _project_uzs(p)
        c["count"] += 1
    top = sorted(clients.values(), key=lambda c: c["amount"], reverse=True)[:5]
    debt = _balance("ar_customers") if _ledger_ok() else None
    kpis = [
        kpi(
            "pipeline",
            "Jarayondagi buyurtmalar",
            pipeline,
            link="/projects?status=confirmed&status=procurement&status=production&status=ready",
            hint=f"{len(live)} ta loyiha",
        ),
        kpi(
            "month_sales",
            "Shu oy sotuv",
            this["amount"],
            hint=f"{this['count']} ta shartnoma",
            link="/projects",
        ),
        kpi(
            "overdue",
            "Muddati o'tgan",
            overdue,
            unit="ta",
            link="/projects?overdue=true",
            tone="bad" if overdue else "",
        ),
    ]
    if debt is not None:
        kpis.append(
            kpi(
                "client_debt",
                "Mijozlar qarzi (4010)",
                debt,
                link="/accounting/reports",
                tone="bad" if debt > 0 else "",
            )
        )
    return {
        "key": "sales",
        "title": "Savdo",
        "link": "/projects",
        "kpis": kpis,
        "series": {
            "sales": [
                {
                    "month": _key(d),
                    "amount": _s(by_month.get(_key(d), {}).get("amount", ZERO)),
                    "count": by_month.get(_key(d), {}).get("count", 0),
                }
                for d in months
            ]
        },
        "lists": {
            "statuses": [{"key": s.value, "label": s.label, "count": statuses.get(s.value, 0)} for s in PS],
            "top_clients": [{**c, "amount": _s(c["amount"])} for c in top],
        },
    }


def crm(months: list[dt.date], today: dt.date) -> dict:
    from apps.crm.models import Lead, LeadStatus

    month_start = today.replace(day=1)
    open_qs = Lead.objects.filter(status=LeadStatus.OPEN)
    budget = open_qs.aggregate(b=Coalesce(Sum("budget"), Value(ZERO), output_field=MONEY))["b"]
    new = Lead.objects.filter(created_at__date__gte=month_start).count()
    closed = Lead.objects.filter(stage_changed_at__date__gte=month_start)
    won, lost = closed.filter(status=LeadStatus.WON).count(), closed.filter(status=LeadStatus.LOST).count()
    rate = round(100 * won / (won + lost)) if won + lost else None
    window = Lead.objects.filter(created_at__date__gte=months[0])
    created = _by_month(window, "created_at", n=Count("id"))
    won_by = _by_month(
        Lead.objects.filter(status=LeadStatus.WON, stage_changed_at__date__gte=months[0]),
        "stage_changed_at",
        n=Count("id"),
    )
    stages = (
        open_qs.values("stage__name", "stage__position")
        .annotate(n=Count("id"), b=Coalesce(Sum("budget"), Value(ZERO), output_field=MONEY))
        .order_by("stage__position")
    )
    return {
        "key": "crm",
        "title": "CRM",
        "link": "/crm",
        "kpis": [
            kpi(
                "open", "Ochiq lidlar", open_qs.count(), unit="ta", link="/crm", hint=f"byudjet {_s(budget)}"
            ),
            kpi("new", "Shu oy yangi", new, unit="ta", link="/crm"),
            kpi("won", "Shu oy yutildi", won, unit="ta", tone="ok" if won else ""),
            kpi(
                "win_rate",
                "Yutish ulushi",
                rate if rate is not None else "—",
                unit="%" if rate is not None else "",
                hint=f"{won} / {won + lost} yopilgan",
            ),
        ],
        "series": {
            "leads": [
                {
                    "month": _key(d),
                    "new": created.get(_key(d), {}).get("n", 0),
                    "won": won_by.get(_key(d), {}).get("n", 0),
                }
                for d in months
            ]
        },
        "lists": {
            "stages": [{"label": r["stage__name"], "count": r["n"], "budget": _s(r["b"])} for r in stages]
        },
    }


def procurement(months: list[dt.date], today: dt.date) -> dict:
    from apps.procurement.models import (
        GoodsReceipt,
        OrderStatus,
        PurchaseOrder,
        PurchaseRequest,
        ReceiptStatus,
        RequestStatus,
    )

    month_start = today.replace(day=1)
    waiting = PurchaseRequest.objects.filter(status=RequestStatus.SUBMITTED).count()
    approved = PurchaseRequest.objects.filter(status=RequestStatus.APPROVED).count()
    sent = PurchaseOrder.objects.filter(status__in=[OrderStatus.SENT, OrderStatus.PARTIALLY_RECEIVED]).count()
    posted = GoodsReceipt.objects.filter(status=ReceiptStatus.POSTED, date__gte=months[0]).select_related(
        "order"
    )
    by_month: dict[str, Decimal] = {}
    suppliers: dict[int, dict] = {}
    for r in posted.prefetch_related("lines").select_related("supplier"):
        gross = r.totals()["gross_uzs"]
        by_month[_key(r.date)] = by_month.get(_key(r.date), ZERO) + gross
        s = suppliers.setdefault(
            r.supplier_id, {"id": r.supplier_id, "name": r.supplier.name, "amount": ZERO}
        )
        s["amount"] += gross
    kpis = [
        kpi(
            "waiting",
            "Tasdiq kutayotgan so'rovlar",
            waiting,
            unit="ta",
            link="/procurement/requests?status=submitted",
            tone="warn" if waiting else "",
        ),
        kpi(
            "approved",
            "Buyurtma kutayotgan so'rovlar",
            approved,
            unit="ta",
            link="/procurement/requests?status=approved",
        ),
        kpi(
            "sent",
            "Yo'ldagi buyurtmalar",
            sent,
            unit="ta",
            link="/procurement/orders?status=sent&status=partially_received",
        ),
        kpi(
            "month_purchases",
            "Shu oy kirim (KR)",
            by_month.get(_key(month_start), ZERO),
            link="/procurement/receipts?status=posted",
        ),
    ]
    if _ledger_ok():
        debt = -_balance("ap_suppliers") - _balance("advance_paid")
        kpis.append(
            kpi(
                "supplier_debt",
                "Yetkazib beruvchilarga qarz",
                debt,
                link="/procurement/suppliers",
                tone="bad" if debt > 0 else "",
            )
        )
    from apps.mrp import selectors as mrp

    short = mrp.plan()["short"]
    kpis.append(kpi("shortage", "MRP kamomadi", short, unit="ta mahsulot", link="/mrp?only_short=true",
                    tone="warn" if short else ""))
    top = sorted(suppliers.values(), key=lambda s: s["amount"], reverse=True)[:5]
    return {
        "key": "procurement",
        "title": "Ta'minot",
        "link": "/procurement/orders",
        "kpis": kpis,
        "series": {
            "purchases": [{"month": _key(d), "amount": _s(by_month.get(_key(d), ZERO))} for d in months]
        },
        "lists": {"top_suppliers": [{**s, "amount": _s(s["amount"])} for s in top]},
    }


def finance(months: list[dt.date], today: dt.date) -> dict:
    from apps.kassa import selectors as kassa
    from apps.kassa.models import OrderKind

    s = kassa.summary()
    orders = kassa.posted_orders().filter(date__gte=months[0]).exclude(kind=OrderKind.TRANSFER)
    by: dict[str, dict] = {}
    for o in orders.only("date", "kind", "amount", "currency", "rate"):
        cell = by.setdefault(_key(o.date), {"in": ZERO, "out": ZERO})
        cell["in" if o.kind == OrderKind.IN else "out"] += o.amount_uzs
    return {
        "key": "finance",
        "title": "Moliya",
        "link": "/kassa",
        "kpis": [
            kpi(
                "total",
                "Jami pul",
                s["total_uzs"],
                link="/kassa",
                hint=f"kassa {_s(s['cash_uzs'])} · bank {_s(s['bank_uzs'])}",
            ),
            kpi("month_in", "Shu oy kirim", s["month_in"], link="/kassa/orders?kind=in", tone="ok"),
            kpi("month_out", "Shu oy chiqim", s["month_out"], link="/kassa/orders?kind=out"),
            kpi(
                "requests",
                "Pul so'rovlari",
                s["payment_requests"],
                unit="ta",
                link="/kassa/payment-requests?status=submitted",
                tone="warn" if s["payment_requests"] else "",
            ),
        ],
        "series": {
            "cash": [
                {
                    "month": _key(d),
                    "in": _s(by.get(_key(d), {}).get("in")),
                    "out": _s(by.get(_key(d), {}).get("out")),
                }
                for d in months
            ]
        },
        "lists": {
            "accounts": [
                {
                    "name": a["name"],
                    "currency": a["currency"],
                    "balance": _s(a["balance"]),
                    "balance_uzs": _s(a["balance_uzs"]),
                }
                for a in s["accounts"]
            ]
        },
    }


def accounting(months: list[dt.date], today: dt.date) -> dict | None:
    if not _ledger_ok():
        return None
    month_start = today.replace(day=1)
    revenue = _role_month(["revenue_products", "revenue_services"], months[0], -1)
    cost = _role_month(["cogs_products"], months[0], +1)
    rev_m, cost_m = revenue.get(_key(month_start), ZERO), cost.get(_key(month_start), ZERO)
    ar = _balance("ar_customers")
    ap = -_balance("ap_suppliers")
    return {
        "key": "accounting",
        "title": "Buxgalteriya",
        "link": "/accounting/reports",
        "kpis": [
            kpi("revenue", "Shu oy daromad (90xx)", rev_m, link="/accounting/reports"),
            kpi("cogs", "Sotilgan tannarx (9110)", cost_m, link="/accounting/reports"),
            kpi(
                "margin",
                "Yalpi foyda",
                rev_m - cost_m,
                tone="ok" if rev_m - cost_m > 0 else "bad" if rev_m - cost_m < 0 else "",
                hint=f"{round(100 * (rev_m - cost_m) / rev_m)}%" if rev_m else "",
            ),
            kpi("ar", "Debitorlar (4010)", ar, link="/accounting/reports"),
            kpi("ap", "Kreditorlar (6010)", ap, link="/accounting/reports"),
        ],
        "series": {
            "pnl": [
                {"month": _key(d), "revenue": _s(revenue.get(_key(d))), "cost": _s(cost.get(_key(d)))}
                for d in months
            ]
        },
        "lists": {},
    }


def inventory(months: list[dt.date], today: dt.date) -> dict:
    from apps.inventory import selectors as inv
    from apps.inventory.models import Category, Product
    from apps.inventory.models import MoveType as T

    cells = inv.balances()
    per_product: dict[int, list[Decimal]] = {}
    for (pid, _wid), (q, v) in cells.items():
        cell = per_product.setdefault(pid, [ZERO, ZERO])
        cell[0] += q
        cell[1] += v
    products = {p.pk: p for p in Product.all_objects.filter(pk__in=per_product)}
    by_cat = {c.value: ZERO for c in Category}
    for pid, (_q, v) in per_product.items():
        by_cat[products[pid].category] += v
    total = sum(by_cat.values(), ZERO)
    top = sorted(
        ((products[pid], q, v) for pid, (q, v) in per_product.items() if q > 0),
        key=lambda t: t[2],
        reverse=True,
    )[:5]
    quiet_since = today - dt.timedelta(days=60)
    moved = set(inv.posted().filter(date__gt=quiet_since).values_list("product_id", flat=True))
    idle = [(products[pid], q, v) for pid, (q, v) in per_product.items() if q > 0 and pid not in moved]
    idle.sort(key=lambda t: t[2], reverse=True)
    window = inv.posted().filter(date__gte=months[0])
    money = lambda *types, neg=False: Coalesce(  # noqa: E731
        Sum(F("amount") * Value(-1 if neg else 1), filter=Q(type__in=types)), Value(ZERO), output_field=MONEY
    )
    by = _by_month(
        window, "date", kirim=money(T.RECEIPT, T.OUTPUT), chiqim=money(T.ISSUE), yetkazish=money(T.DELIVERY)
    )
    month_start = today.replace(day=1)
    this = by.get(_key(month_start), {})

    def row(p, q, v):
        return {
            "id": p.pk,
            "code": p.code,
            "name": p.name,
            "unit": p.unit,
            "category": p.category,
            "qty": str(q),
            "value": _s(v),
        }

    return {
        "key": "inventory",
        "title": "Ombor",
        "link": "/inventory/moves",
        "kpis": [
            kpi("stock_value", "Ombordagi qiymat", total, link="/inventory/stock"),
            kpi(
                "month_in",
                "Shu oy kirim",
                this.get("kirim") or ZERO,
                link="/inventory/moves?type=receipt&type=output",
            ),
            kpi(
                "month_issue", "Shu oy chiqim", this.get("chiqim") or ZERO, link="/inventory/moves?type=issue"
            ),
            kpi(
                "month_delivery",
                "Shu oy yetkazish",
                this.get("yetkazish") or ZERO,
                link="/inventory/moves?type=delivery",
            ),
            kpi(
                "idle",
                "60 kun harakatsiz",
                len(idle),
                unit="ta",
                link="/inventory/stock",
                tone="warn" if idle else "",
            ),
        ],
        "series": {"moves": _series(months, by, ["kirim", "chiqim", "yetkazish"])},
        "lists": {
            "by_category": [
                {"key": c.value, "label": c.label, "value": _s(by_cat[c.value])} for c in Category
            ],
            "top_products": [row(*t) for t in top],
            "idle": [row(*t) for t in idle[:5]],
        },
    }


def hr(months: list[dt.date], today: dt.date) -> dict:
    from apps.employees.models import Employee, EmployeeStatus

    active = Employee.objects.filter(status=EmployeeStatus.ACTIVE)
    by_dep = active.values("department").annotate(n=Count("id")).order_by("-n")
    hired = _by_month(Employee.objects.filter(hire_date__gte=months[0]), "hire_date", n=Count("id"))
    return {
        "key": "hr",
        "title": "Xodimlar",
        "link": "/employees",
        "kpis": [
            kpi("active", "Ishlamoqda", active.count(), unit="kishi", link="/employees?status=active"),
            kpi(
                "on_leave",
                "Ta'tilda",
                Employee.objects.filter(status=EmployeeStatus.ON_LEAVE).count(),
                unit="kishi",
                link="/employees?status=on_leave",
            ),
        ],
        "series": {"hired": _series(months, hired, ["n"], money=False)},
        "lists": {"departments": [{"label": r["department"] or "—", "count": r["n"]} for r in by_dep]},
    }


# order on the page; (section, pages that open it — any of them)
SECTIONS = [
    (sales, (Pages.PROJECTS,)),
    (crm, (Pages.CRM,)),
    (procurement, (Pages.PROCUREMENT, Pages.PURCHASE_ORDERS)),
    (finance, (Pages.KASSA,)),
    (accounting, (Pages.ACCOUNTING_REPORTS,)),
    (inventory, (Pages.STOCK,)),
    (hr, (Pages.EMPLOYEES,)),
]


def dashboard(user, *, today: dt.date | None = None, n_months: int = 12) -> dict:
    today = today or dt.date.today()
    months = months_back(n_months, today)
    _RATE_CACHE.clear()
    sections = []
    for fn, pages in SECTIONS:
        if any(has_permission(user, p, Action.VIEW) for p in pages):
            sec = fn(months, today)
            if sec is not None:
                sections.append(sec)
    return {"months": [_key(d) for d in months], "today": today.isoformat(), "sections": sections}
