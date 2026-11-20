# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Moliya: kassa and bank, cash orders, the cash book and money requests (frontend/src/modules/guide/chapters/kassa.ts)."""

from django.db.models import Count

from apps.kassa.models import CashAccount, CashOrder, PaymentRequest
from apps.projects.models import Project


def ids() -> dict:
    """A posted customer kirim, the USD kassa, the busiest day of the main kassa, an approved money request."""
    pko = CashOrder.objects.filter(status="posted", kind="in", project__isnull=False, partner__isnull=False).order_by("-pk").first()
    usd = CashAccount.objects.filter(currency="USD", is_active=True).order_by("pk").first()
    cash = CashAccount.objects.filter(kind="cash", currency="UZS", is_active=True).order_by("pk").first()
    day = (CashOrder.objects.filter(status="posted", account=cash).values("date").annotate(n=Count("pk")).order_by("-n", "-date").first()
           if cash else None)
    req = PaymentRequest.objects.filter(status="approved").order_by("pk").first()
    proj = Project.objects.filter(status="production", client__isnull=False).order_by("pk").first()
    return {
        "pko": pko.pk if pko else None,
        "usd": usd.pk if usd else None,
        "cash": cash.pk if cash else None,
        "day": day["date"].isoformat() if day else "",
        "request": req.pk if req else None,
        "project": proj.pk if proj else None,
    }


def shots(ids: dict) -> list[dict]:
    pko, usd, cash, day, req, proj = ids["pko"], ids["usd"], ids["cash"], ids["day"], ids["request"], ids["project"]
    return [
        {
            "name": "kassa",
            "path": "/kassa",
            "wait": "Asosiy kassa",
            "marks": [
                ["header a", "Kirim"],
                ["header button", "Chiqim"],
                ["header button", "O'tkazma"],
                ["div.rounded-xl", "Jami pul"],
                ["button", "Pul so'rovlari"],
                ["div.grid.rounded-xl", "Asosiy kassa"],
                ["button", "To'lov maqsadlari"],
            ],
        },
        {
            "name": "account-dialog",
            "path": "/kassa",
            "wait": "Asosiy kassa",
            "steps": [["click", "button", "Yangi kassa / hisob"]],
            "crop": True,
            "marks": [
                ["[role=dialog] label", "Turi"],
                ["[role=dialog] label", "Valyuta"],
                ["[role=dialog] label", "Buxgalteriya hisobi"],
                ["[role=dialog] label", "Kassa limiti"],
            ],
        },
        {
            "name": "purposes",
            "path": "/kassa?tab=purposes",
            "wait": "Maqsad o'tkazmani belgilaydi",
            "marks": [["th", "YO'NALISH"], ["th", "O'TKAZMA"], ["th", "TALAB"], ["tbody tr", "Mijozdan to'lov"]],
        },
        {
            "name": "orders",
            "path": "/kassa/orders",
            "wait": "PKO-",
            "marks": [
                ["header button", "Kirim"],
                ["header button", "Boshqa"],
                ["button", "=Barchasi"],
                ["button", "=Qoralama"],
                ["select", "Barcha hisoblar"],
                ["tbody tr", "PKO-"],
            ],
        },
        {
            "name": "order-new",
            "path": "/kassa/orders/new?kind=in",
            "wait": "Yangi kirim",
            "marks": [
                ["div.grid:has(> span)", "Turi"],
                ["div.grid:has(> span)", "Kassa / bank"],
                ["div.grid:has(> span)", "Maqsad"],
                ["div.grid:has(> span)", "Summa"],
                ["div.grid:has(> span)", "Kontragent"],
                ["div.grid:has(> span)", "Loyiha"],
                ["button", "Saqlash"],
            ],
        },
        {
            "name": "order-from-project",
            "path": f"/projects/{proj}",
            "wait": "Buyurtma №",
            "steps": [["click", "button", "To'lov qo'shish"], ["wait", 2500]],
            "marks": [
                ["div.grid:has(> span)", "Summa"],
                ["div.grid:has(> span)", "Qarzi:"],
                ["div.grid:has(> span)", "Loyiha"],
                ["div.grid:has(> span)", "=Asos"],
                ["p", "O'tkaziladi:"],
            ],
        },
        {
            "name": "order-usd",
            "path": f"/kassa/orders/new?kind=in&account={usd}",
            "wait": "Yangi kirim",
            "steps": [["fill", "div.grid:has(> span:has-text('Summa')) input", "1000"], ["fill", "div.grid:has(> span:has-text('Kurs')) input", "12000"]],
            "crop": True,
            "marks": [["div.grid:has(> span)", "Kassa / bank"], ["div.grid:has(> span)", "Summa"], ["div.grid:has(> span)", "Kurs"]],
        },
        {
            "name": "order-posted",
            "path": f"/kassa/orders/{pko}",
            "wait": "PKO-",
            "marks": [
                ["button", "Bekor qilish"],
                ["button", "Chop etish"],
                ["[aria-label='Bosqichlar']", ""],
                ["button", "O'tkazma"],
                ["button", "Kontragent saldosi"],
                ["p", "O'tkazilgan: maydonlar qulflangan"],
            ],
        },
        {
            "name": "order-cancel",
            "path": f"/kassa/orders/{pko}",
            "wait": "PKO-",
            "steps": [["click", "button", "Bekor qilish"]],
            "crop": True,
            "marks": [["[role=dialog] p", "storno"], ["[role=dialog] textarea", ""], ["[role=dialog] button", "Bekor qilish"]],
        },
        {
            "name": "book",
            "path": f"/kassa/book?account={cash}&date={day}",
            "wait": "Kun boshiga qoldiq",
            "marks": [
                ["select", ""],
                ["input[type=date]", ""],
                ["button", "=Bugun"],
                ["header button", "Chop etish"],
                ["tbody tr", "Kun boshiga qoldiq"],
                ["tbody tr", "-0"],
                ["tfoot tr", "Kun oxiriga qoldiq"],
            ],
        },
        {
            "name": "requests",
            "path": "/kassa/payment-requests",
            "wait": "PS-",
            "marks": [["header button", "Yangi so'rov"], ["button", "=Kutilmoqda"], ["tbody tr", "Tasdiqlandi"]],
        },
        {
            "name": "request",
            "path": f"/kassa/payment-requests/{req}",
            "wait": "Pul so'rovi №",
            "marks": [
                ["button", "Pul berish"],
                ["[aria-label='Bosqichlar']", ""],
                ["button", "=Bekor qilish"],
                ["button", "To'langan"],
                ["div.grid", "TO'LOVLAR"],
            ],
        },
        {
            "name": "request-pay",
            "path": f"/kassa/payment-requests/{req}",
            "wait": "Pul so'rovi №",
            "steps": [["click", "button", "Pul berish"], ["wait", 2500]],
            "marks": [
                ["div.grid:has(> span)", "Maqsad"],
                ["div.grid:has(> span)", "Summa"],
                ["div.grid:has(> span)", "Kontragent"],
                ["div.grid:has(> span)", "Pul so'rovi"],
                ["button", "Saqlash"],
            ],
        },
    ]
