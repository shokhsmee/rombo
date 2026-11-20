# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Ombor: stock moves, balances, products and warehouses (frontend/src/modules/guide/chapters/inventory.ts)."""

from apps.inventory.models import Product, StockMove


def _move(**kw) -> int | None:
    m = StockMove.objects.filter(**kw).order_by("-pk").first()
    return m.pk if m else None


def ids() -> dict:
    """A draft move, a posted chiqim and a posted delivery; a product with a purchase unit."""
    profile = Product.objects.exclude(purchase_unit="").order_by("pk").first() or Product.objects.order_by("pk").first()
    return {
        "draft": _move(status="draft"),
        "issue": _move(status="posted", type="issue"),
        "product": profile.pk if profile else None,
    }


def shots(ids: dict) -> list[dict]:
    d, issue, prod = ids["draft"], ids["issue"], ids["product"]
    return [
        {
            "name": "moves",
            "path": "/inventory/moves",
            "wait": "OM-",
            "marks": [
                ["header button", "Chiqim"],
                ["header button", "Boshqa"],
                ["button", "Kirim, so'm"],
                ["button", "Ombordagi qoldiq"],
                ["button", "=Ishlab chiqarish"],
                ["button", "=Qoralama"],
                ["tbody tr", "OM-"],
            ],
        },
        {
            "name": "moves-menu",
            "path": "/inventory/moves",
            "wait": "OM-",
            "steps": [["click", "header button", "Boshqa"]],
            "crop": True,
            "marks": [["header button", "Boshqa"], [".pop", ""]],
        },
        {
            "name": "move-new",
            "path": "/inventory/moves/new?type=issue",
            "wait": "Yangi: chiqim",
            "marks": [
                ["div.grid:has(> span)", "Turi"],
                ["div.grid:has(> span)", "Mahsulot *"],
                ["div.grid:has(> span)", "Ombor *"],
                ["div.grid:has(> span)", "Miqdor *"],
                ["div.grid:has(> span)", "Loyiha *"],
                ["button", "Saqlash"],
            ],
        },
        {
            "name": "move-draft",
            "path": f"/inventory/moves/{d}",
            "wait": "OM-",
            "marks": [
                ["button", "O'tkazish"],
                ["[aria-label='Bosqichlar']", ""],
                ["div.grid:has(> span)", "Bu omborda"],
                ["span", "rad etiladi"],
                ["button", "O'chirish"],
            ],
        },
        {
            "name": "move-posted",
            "path": f"/inventory/moves/{issue}",
            "wait": "OM-",
            "marks": [
                ["button", "Bekor qilish"],
                ["button", "so'm"],
                ["button", "O'tkazma"],
                ["button", "LY-26-"],
                ["p", "O'tkazilgan: maydonlar qulflangan"],
            ],
        },
        {
            "name": "stock",
            "path": "/inventory/stock",
            "wait": "Ombordagi qiymat",
            "marks": [
                ["div.rounded-xl", "Ombordagi qiymat"],
                ["select", "Barcha omborlar"],
                ["label", "Nol qoldiqlar ham"],
                ["button", "Excel"],
                ["tbody tr", ""],
            ],
        },
        {
            "name": "products",
            "path": "/inventory/products",
            "wait": "MH-",
            "marks": [
                ["header button", "Mahsulot"],
                ["input[placeholder*='Nomi']", ""],
                ["button", "=Profil"],
                ["th", "QOLDIQ"],
                ["tbody tr", "MH-"],
            ],
        },
        {
            "name": "product",
            "path": f"/inventory/products/{prod}",
            "wait": "MH-",
            "marks": [
                ["div.grid:has(> span)", "Turkum"],
                ["div.grid:has(> span)", "O'lchov birligi"],
                ["div.grid:has(> span)", "Xarid birligi"],
                ["div.grid:has(> span)", "Standart tannarx"],
                ["button", "Qoldiq"],
                ["button", "Chiqim"],
            ],
        },
        {
            "name": "warehouses",
            "path": "/inventory/warehouses",
            "wait": "Asosiy ombor",
            "crop": True,
            "marks": [["header button", "Ombor"], ["tbody tr", "Asosiy ombor"], ["button[aria-label='Tahrirlash']", ""]],
        },
        {
            "name": "warehouse-dialog",
            "path": "/inventory/warehouses",
            "wait": "Asosiy ombor",
            "steps": [["click", "header button", "Ombor"]],
            "crop": True,
            "marks": [["[role=dialog] label", "Nomi"], ["[role=dialog] label", "Mas'ul"], ["[role=dialog] label", "Asosiy ombor"], ["[role=dialog] label", "=Faol"]],
        },
    ]
