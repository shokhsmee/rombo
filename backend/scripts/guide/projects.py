# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Loyihalar: the order's way from a draft to closing (frontend/src/modules/guide/chapters/projects.ts)."""

from apps.projects.models import Project


def _first(status: str) -> int | None:
    p = Project.objects.filter(status=status).order_by("pk").first()
    return p.pk if p else None


def ids() -> dict:
    """One Loyiha per stage of the local demo: what each picture needs to show."""
    draft_calc = Project.objects.filter(status="draft", calcs__isnull=False).order_by("pk").first()
    return {
        "draft": draft_calc.pk if draft_calc else _first("draft"),
        "calc": draft_calc.calcs.order_by("pk").first().pk if draft_calc else None,
        "confirmed": _first("confirmed"),
        "procurement": _first("procurement"),
        "production": _first("production"),
    }


def shots(ids: dict) -> list[dict]:
    d, c, conf, proc, prod = ids["draft"], ids["calc"], ids["confirmed"], ids["procurement"], ids["production"]
    return [
        {
            "name": "list",
            "path": "/projects",
            "wait": "LY-26-",
            "marks": [
                ["header a", "Yangi loyiha"],
                ["button", "Barchasi"],
                ["input[placeholder*='Kod']", ""],
                ["label", "Muddati o'tgan"],
                ["button", "Excel"],
                ["tbody tr", "LY-26-"],
            ],
        },
        {
            "name": "new",
            "path": "/projects/new",
            "wait": "Yangi loyiha",
            "marks": [
                ["div.grid", "Loyiha nomi"],
                ["div.grid", "Mijoz (F.I.O.)"],
                ["div.grid", "Topshirish muddati"],
                ["div.rounded-xl", "BUYURTMA TURI"],
                ["button", "Saqlash"],
            ],
        },
        {
            "name": "client-create",
            "path": "/projects/new",
            "wait": "Yangi loyiha",
            "steps": [["fill", "div.grid:has(> span:has-text('Mijoz (F.I.O.)')) input", "Ali Valiyev"], ["wait", 800]],
            "crop": True,
            "marks": [["div.grid", "Mijoz (F.I.O.)"], ["button", "yaratish"], ["button", "Yaratish va to'ldirish"]],
        },
        {
            "name": "card",
            "path": f"/projects/{conf}",
            "wait": "Buyurtma №",
            "marks": [
                ["button", "Xaridga o'tkazish"],
                ["button", "Boshqa"],
                ["[aria-label='Bosqichlar']", ""],
                ["button", "Mijoz"],
                ["button", "Qarz"],
                ["button", "Hujjatlar"],
            ],
        },
        {
            "name": "status-more",
            "path": f"/projects/{conf}",
            "wait": "Buyurtma №",
            "steps": [["click", "button", "Boshqa"]],
            "crop": True,
            "marks": [["button", "Xaridga o'tkazish"], [".pop", ""]],
        },
        {
            "name": "locked",
            "path": f"/projects/{proc}",
            "wait": "Buyurtma №",
            "crop": True,
            "marks": [["[aria-label='Bosqichlar']", ""], ["div.rounded-xl", "qulflangan"]],
        },
        {
            "name": "money",
            "path": f"/projects/{prod}",
            "wait": "Buyurtma №",
            "scroll": "Buyurtma summasi",
            "marks": [
                ["div.grid", "Buyurtma summasi"],
                ["div.grid:has(> span)", "=Avans"],
                ["div.grid", "buyurtma + xizmat"],
                ["div", "Hisob-faktura: "],
                ["button", "To'lov qo'shish"],
                ["button", "Hisob-faktura chiqarish"],
            ],
        },
        {
            "name": "calcs",
            "path": f"/projects/{d}",
            "wait": "Buyurtma №",
            "scroll": "Hisob-kitob",
            "marks": [["div.rounded-xl.border", "seriya"], ["button[title='Chop etish']", ""], ["button", "Hisob-kitob qo'shish"]],
        },
        {
            "name": "calc",
            "path": f"/projects/{d}/calcs/{c}",
            "wait": "Hisob-kitob",
            "marks": [["button", "Narxlarni yangilash"], ["button", "Chop etish"], ["label", "Faqat to'ldirilganlar"], ["tbody tr input", ""], ["div", "Jami"]],
        },
        {
            "name": "documents",
            "path": f"/projects/{d}",
            "wait": "Buyurtma №",
            "steps": [["click", "button", "Hujjatlar"]],
            "crop": True,
            "marks": [[".pop button", "Shartnoma"], [".pop button", "Hisob-kitob"]],
        },
        {
            "name": "history",
            "path": f"/projects/{prod}",
            "wait": "Buyurtma №",
            "crop": True,
            "marks": [["aside textarea", ""], ["aside button", "Izohlar"], ["aside div.grid", "Holat:"]],
        },
        {
            "name": "cancel",
            "path": f"/projects/{d}",
            "wait": "Buyurtma №",
            "steps": [["click", "button", "Boshqa"], ["click", ".pop button", "Bekor qilish"]],
            "crop": True,
            "marks": [["[role=dialog] textarea", ""], ["[role=dialog] button", "Bekor qilish"]],
        },
    ]
