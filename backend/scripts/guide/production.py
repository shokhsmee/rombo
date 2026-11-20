# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Ishlab chiqarish: Tarkiblar (BOM), the Loyiha's materials, MRP and the three one-step moves from
the Loyiha card (frontend/src/modules/guide/chapters/production.ts). Dialogs are opened, never confirmed."""

from apps.mrp.models import Bom, ItemSpec
from apps.projects.models import Project


def _with_specs(*statuses: str) -> int | None:
    """A Loyiha in one of these stages whose items have a product chosen (so it has materials)."""
    ids = ItemSpec.objects.filter(project__status__in=statuses, product__isnull=False).values_list("project_id", flat=True)
    p = Project.objects.filter(pk__in=ids, constructions__isnull=True).order_by("pk").first() or Project.objects.filter(pk__in=ids).order_by("pk").first()
    return p.pk if p else None


def ids() -> dict:
    bom = max(Bom.objects.filter(is_active=True), key=lambda b: b.lines.count(), default=None)
    return {
        "bom": bom.pk if bom else None,
        # a draft: materials follow the items, every button is there
        "draft": _with_specs("draft"),
        # a confirmed Loyiha: materials are frozen, it counts in MRP, the factory moves start from it
        "open": _with_specs("confirmed", "procurement", "production", "ready"),
    }


def _menu(item: str) -> list:
    return [["click", "main button:has(svg.lucide-factory)", ""], ["click", ".pop button", item]]


def shots(ids: dict) -> list[dict]:
    b, d, o = ids["bom"], ids["draft"], ids["open"]
    return [
        # — Tarkiblar —
        {
            "name": "bom-list",
            "path": "/mrp/boms",
            "wait": "BM-",
            "marks": [
                ["button", "=Tarkib"],
                ["div.inline-flex", "Eski versiyalar"],
                ["button", "Qatorlar Excel"],
                ["tbody tr", "BM-"],
            ],
        },
        {
            "name": "bom-form",
            "path": f"/mrp/boms/{b}",
            "wait": "Tarkib ·",
            "marks": [
                ["div.grid:has(> span)", "Tayyor mahsulot (yarim"],
                ["button", "Tannarx / m²"],
                ["th", "=ASOS"],
                ["th", "CHIQINDI"],
                ["p", "«1 m² ga»"],
            ],
        },
        {
            "name": "bom-try",
            "path": f"/mrp/boms/{b}",
            "wait": "Tarkib ·",
            "scroll": "Sinab ko'rish",
            "crop": True,
            "marks": [["div.flex-wrap", "m² jami"], ["ul.grid", ""]],
        },
        # — Loyiha materiallari —
        {
            "name": "materials",
            "path": f"/projects/{d}",
            "wait": "Buyurtma №",
            "scroll": "Materiallar (tarkib bo'yicha)",
            "marks": [
                ["tbody tr", "m² ×"],
                ["td", "tarkibi"],
                ["table", "CHIQIM QILINGAN"],
                ["button", "BOM'dan hisob-kitobga"],
                ["button", "=Xarid so'rovi"],
                ["button", "Materiallarni berish"],
                ["button", "Qayd etish"],
            ],
        },
        {
            "name": "materials-frozen",
            "path": f"/projects/{o}",
            "wait": "Buyurtma №",
            "scroll": "Materiallar (tarkib bo'yicha)",
            "crop": True,
            "marks": [["p", "qayd etilgan"], ["button", "Qayta hisoblash"]],
        },
        # — MRP —
        {
            "name": "mrp",
            "path": "/mrp",
            "wait": "MRP — material rejasi",
            "marks": [
                ["button", "Kamomad"],
                ["label", "Faqat kamomad"],
                ["th", "=OMBORDA"],
                ["th", "YO'LDA"],
                ["th", "SOTIB OLISH"],
                ["button", "Xarid so'rovi yaratish"],
            ],
        },
        {
            "name": "mrp-open",
            "path": "/mrp",
            "wait": "MRP — material rejasi",
            "steps": [["click", "tbody tr button", ""]],
            "crop": True,
            "marks": [["tbody tr:first-child button", ""], ["tbody tr", "muddat"]],
        },
        # — Sexda: uch qadam —
        {
            "name": "prod-menu",
            "path": f"/projects/{o}",
            "wait": "Buyurtma №",
            "steps": [["click", "main button:has(svg.lucide-factory)", ""]],
            "crop": True,
            "marks": [[".pop button", "1. Materiallarni"], [".pop button", "2. Tayyor"], [".pop button", "3. Mijozga"]],
        },
        {
            "name": "prod-issue",
            "path": f"/projects/{o}",
            "wait": "Buyurtma №",
            "steps": _menu("1. Materiallarni"),
            "marks": [
                ["[role=dialog] select", ""],
                ["[role=dialog] tbody tr", "omborda"],
                ["[role=dialog] button", "Boshqa material qo'shish"],
                ["[role=dialog] a", "Batafsil forma"],
                ["[role=dialog] button", "Berish"],
            ],
        },
        {
            "name": "prod-output",
            "path": f"/projects/{o}",
            "wait": "Buyurtma №",
            "steps": _menu("2. Tayyor"),
            "marks": [["[role=dialog] tbody tr", "buyurtmada"], ["[role=dialog] button", "Qabul qilish"]],
        },
        {
            "name": "prod-deliver",
            "path": f"/projects/{o}",
            "wait": "Buyurtma №",
            "steps": _menu("3. Mijozga"),
            "crop": True,
            "marks": [["[role=dialog] p", "Mijoz:"], ["[role=dialog] tbody tr", ""], ["[role=dialog] button", "Yetkazish"]],
        },
    ]
