# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Ta'minot: purchase request → approval → order to the supplier → goods receipt, and suppliers
(frontend/src/modules/guide/chapters/procurement.ts). Nothing is saved: dialogs are opened and left."""

from apps.clients.models import Client
from apps.procurement.models import ApprovalStep, GoodsReceipt, PurchaseOrder, PurchaseRequest
from apps.projects.models import Project


def _pk(qs) -> int | None:
    x = qs.order_by("pk").first()
    return x.pk if x else None


def ids() -> dict:
    """The records each picture needs, found by what they are (status, lines, approvals)."""
    order = PurchaseOrder.objects.filter(status__in=["sent", "partially_received"]).order_by("pk").first()
    return {
        # a request that went through the approval steps and has many lines
        "request": _pk(PurchaseRequest.objects.filter(approvals__isnull=False).distinct()),
        # «Xaridga yuborish» shows on a Loyiha with a calculation
        "project": _pk(Project.objects.filter(calcs__isnull=False, status__in=["draft", "confirmed"]).distinct()),
        "order": order.pk if order else _pk(PurchaseOrder.objects.all()),
        # a received order: its lines have prices and «Keldi» filled in
        "order_done": _pk(PurchaseOrder.objects.filter(status="received").order_by("-pk")) or (order.pk if order else None),
        "receipt_draft": _pk(GoodsReceipt.objects.filter(status="draft")),
        "receipt_posted": _pk(GoodsReceipt.objects.filter(status="posted", warehouse__isnull=False)) or _pk(GoodsReceipt.objects.filter(status="posted")),
        "supplier": order.supplier_id if order else _pk(Client.objects.filter(kind="supplier")),
        "step": _pk(ApprovalStep.objects.filter(is_active=True)),
    }


def shots(ids: dict) -> list[dict]:
    r, p, o, rd, rp, s = ids["request"], ids["project"], ids["order"], ids["receipt_draft"], ids["receipt_posted"], ids["supplier"]
    return [
        # — Xarid so'rovi —
        {
            "name": "req-list",
            "path": "/procurement/requests",
            "wait": "XS-",
            "marks": [
                ["a", "Yangi so'rov"],
                ["div.no-scrollbar", "Barchasi"],
                ["input[placeholder*='Kod']", ""],
                ["label", "Tasdiq kutmoqda"],
                ["tbody tr", "XS-"],
            ],
        },
        {
            "name": "from-project",
            "path": f"/projects/{p}",
            "wait": "Buyurtma №",
            "crop": True,
            "marks": [["button", "Xaridga yuborish"]],
        },
        {
            "name": "req-new",
            "path": "/procurement/requests/new",
            "wait": "Yangi xarid so'rovi",
            "marks": [
                ["div.grid:has(> span)", "=Loyiha *"],
                ["div.grid:has(> span)", "=Kerak sana"],
                ["button", "Qator qo'shish"],
                ["button", "Saqlash"],
            ],
        },
        {
            "name": "req-card",
            "path": f"/procurement/requests/{r}",
            "wait": "Xarid so'rovi №",
            "marks": [
                ["[aria-label='Bosqichlar']", ""],
                ["button", "Buyurtmada"],
                ["th", "=BUYURTMADA"],
                ["[aria-label='Tasdiqlash bosqichlari']", ""],
            ],
        },
        {
            "name": "req-approvals",
            "path": f"/procurement/requests/{r}",
            "wait": "Xarid so'rovi №",
            "steps": [["js", "document.body.style.paddingBottom = '900px'; window.scrollTo({top: document.querySelector(\"[aria-label='Tasdiqlash bosqichlari']\").getBoundingClientRect().top + scrollY - 300, behavior: 'instant'})"]],
            "crop": True,
            "marks": [["[aria-label='Tasdiqlash bosqichlari']", ""], ["ul.grid", "Tasdiqlandi"]],
        },
        {
            "name": "steps",
            "path": "/settings/approval-steps",
            "wait": "Tasdiqlash bosqichlari",
            "marks": [["button", "Bosqich qo'shish"], ["tbody tr", ""], ["th", "KIM TASDIQLAYDI"]],
        },
        {
            "name": "step-edit",
            "path": "/settings/approval-steps",
            "wait": "Tasdiqlash bosqichlari",
            "steps": [["click", "button[aria-label='Tahrirlash']", ""]],
            "crop": True,
            "marks": [["[role=dialog] label", "Tartib"], ["[role=dialog] label", "Nomi"], ["[role=dialog] label", "Kim tasdiqlaydi"], ["[role=dialog] label", "Faol"]],
        },
        # — Buyurtma —
        {
            "name": "ord-list",
            "path": "/procurement/orders",
            "wait": "XB-",
            "marks": [["div.no-scrollbar", "Barchasi"], ["input[placeholder*='Kod']", ""], ["tbody tr", "XB-"]],
        },
        {
            "name": "ord-card",
            "path": f"/procurement/orders/{o}",
            "wait": "Buyurtma №",
            "marks": [
                ["[aria-label='Bosqichlar']", ""],
                ["button", "Qayta yuborish"],
                ["a", "Pul:"],
                ["button", "Kirim qilish"],
                ["div.rounded-xl", "qatorlari o'zgartirilmaydi"],
                ["button", "Qarzimiz"],
            ],
        },
        {
            "name": "ord-lines",
            "path": f"/procurement/orders/{ids['order_done']}",
            "wait": "Buyurtma №",
            "steps": [["js", "document.body.style.paddingBottom = '900px'; window.scrollTo({top: document.querySelector('table').getBoundingClientRect().top + scrollY - 140, behavior: 'instant'})"]],
            "marks": [["th", "=KELDI"], ["th", "NARX,"], ["div.flex-wrap.justify-end", "Jami"]],
        },
        {
            "name": "ord-send",
            "path": f"/procurement/orders/{o}",
            "wait": "Buyurtma №",
            "steps": [["click", "button", "Qayta yuborish"]],
            "crop": True,
            "marks": [["[role=dialog] div.inline-flex", "Chop etib"], ["[role=dialog] label", "Kimga"], ["[role=dialog] button", "Yuborildi deb belgilash"]],
        },
        # — Kirim —
        {
            "name": "rcp-list",
            "path": "/procurement/receipts",
            "wait": "KR-",
            "marks": [["div.no-scrollbar", "Barchasi"], ["tbody tr", "KR-"]],
        },
        {
            "name": "rcp-draft",
            "path": f"/procurement/receipts/{rd}",
            "wait": "Kirim №",
            "marks": [
                ["button", "O'tkazish"],
                ["button", "Buyurtma"],
                ["div.grid:has(> span)", "O'tkazilganda har qator"],
                ["div.grid:has(> span)", "=Hisob-faktura №"],
            ],
        },
        {
            "name": "rcp-lines",
            "path": f"/procurement/receipts/{rd}",
            "wait": "Kirim №",
            "scroll": "KELGAN TOVAR",
            "crop": True,
            "marks": [["th", "OMBORDAGI"], ["th", "AVVAL"], ["th", "=KELDI"]],
        },
        {
            "name": "rcp-posted",
            "path": f"/procurement/receipts/{rp}",
            "wait": "Kirim №",
            "marks": [["[aria-label='Bosqichlar']", ""], ["button", "Bekor qilish (storno)"], ["button", "Ombor ·"], ["div.grid:has(> span)", "=Jurnal"]],
        },
        # — Yetkazib beruvchilar —
        {
            "name": "sup-list",
            "path": "/procurement/suppliers",
            "wait": "Yetkazib beruvchilar",
            "marks": [["a", "Yangi yetkazib beruvchi"], ["th", "SHARTLAR"], ["th", "SALDO"], ["tbody tr", ""]],
        },
        {
            "name": "sup-card",
            "path": f"/procurement/suppliers/{s}",
            "wait": "Yetkazib beruvchi",
            "marks": [
                ["div.grid:has(> span)", "=Email"],
                ["div.grid:has(> span)", "=Hisob raqami"],
                ["div.grid:has(> span)", "Narx valyutasi"],
                ["div.grid:has(> span)", "Oldindan to'lov"],
                ["div.grid:has(> span)", "=Kredit kunlari"],
            ],
        },
    ]
