# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Buxgalteriya: the journal, invoices, reports, the chart of accounts and USD rates
(frontend/src/modules/guide/chapters/accounting.ts). Shot on the local demo: posted documents, invoices of Loyihas."""

from django.utils import timezone

from apps.accounting.models import Invoice, JournalEntry


def ids() -> dict:
    draft = Invoice.objects.filter(status="draft", currency="UZS").order_by("pk").first() or Invoice.objects.filter(status="draft").order_by("pk").first()
    conf = Invoice.objects.filter(status="confirmed", entry__isnull=False).order_by("-pk").first()
    entry = conf.entry_id if conf else JournalEntry.objects.filter(source_kind="document").order_by("pk").values_list("pk", flat=True).first()
    return {
        "draft": draft.pk if draft else None,
        "confirmed": conf.pk if conf else None,
        "entry": entry,
        "partner": conf.partner_id if conf else None,
        "from": f"{timezone.localdate().year}-01-01",
    }


def shots(ids: dict) -> list[dict]:
    dr, cf, e, partner, frm = ids["draft"], ids["confirmed"], ids["entry"], ids["partner"], ids["from"]
    return [
        {
            "name": "journal",
            "path": "/accounting",
            "wait": "BX-",
            "marks": [
                ["header a", "Qo'lda o'tkazma"],
                ["input[placeholder*='mazmun']", ""],
                ["div.inline-flex.rounded-lg:has(> button)", "Barchasi"],
                ["input[type=date]", ""],
                ["tbody tr", "BX-"],
            ],
        },
        {
            "name": "entry",
            "path": f"/accounting/entries/{e}",
            "wait": "O'tkazma",
            "marks": [
                ["button", "Storno"],
                ["a", "Hisob-faktura"],
                ["div.grid", "Kim"],
                ["table", "DEBET"],
            ],
        },
        {
            "name": "manual",
            "path": "/accounting/entries/new",
            "wait": "Boshlang'ich qoldiq yoki tuzatish",
            "marks": [
                ["div.grid:has(> span)", "Mazmuni"],
                ["tbody tr td:first-child select", ""],
                ["button", "Qator qo'shish"],
                ["span.ml-auto", "Dt "],
                ["button", "O'tkazish"],
            ],
        },
        {
            "name": "invoices",
            "path": "/accounting/invoices",
            "wait": "HF-",
            "marks": [
                ["header a", "Yangi hisob-faktura"],
                ["div.inline-flex.rounded-lg:has(> button)", "Mijozga"],
                ["div.flex.gap-1", "Qoralama"],
                ["tbody tr", "HF-"],
                ["th", "O'TKAZMA"],
            ],
        },
        {
            "name": "invoice-draft",
            "path": f"/accounting/invoices/{dr}",
            "wait": "Hisob-faktura HF-",
            "marks": [
                ["button", "Tasdiqlash"],
                ["[aria-label='Bosqichlar']", ""],
                ["div.grid:has(> span)", "Loyiha"],
                ["div.grid:has(> span)", "ESF №"],
                ["tbody tr select", ""],
                ["div.ml-auto.grid", "Jami:"],
            ],
        },
        {
            "name": "invoice-confirm",
            "path": f"/accounting/invoices/{dr}",
            "wait": "Hisob-faktura HF-",
            "steps": [["click", "button", "Tasdiqlash"]],
            "crop": True,
            "marks": [["[role=dialog] p", "jurnalga o'tkaziladi"], ["[role=dialog] button", "Tasdiqlash"]],
        },
        {
            "name": "invoice-confirmed",
            "path": f"/accounting/invoices/{cf}",
            "wait": "Hisob-faktura HF-",
            "marks": [
                ["button", "Bekor qilish"],
                ["button", "O'tkazma"],
                ["button", "Kontragent saldosi"],
                ["p", "qatorlar qulflangan"],
            ],
        },
        {
            "name": "trial",
            "path": f"/accounting/reports?from={frm}",
            "wait": "Oborot-saldo",
            "marks": [
                ["div.inline-flex.rounded-lg:has(> button)", "Oborot-saldo"],
                ["div.mb-3", "gacha"],
                ["tbody tr a", "1010"],
                ["tfoot tr", "Jami"],
            ],
        },
        {
            "name": "act",
            "path": f"/accounting/reports?r=act&partner={partner}&from={frm}",
            "wait": "Solishtirma dalolatnoma",
            "marks": [
                ["button", "Solishtirma dalolatnoma"],
                ["div.w-64", ""],
                ["button", "Chop etish"],
                ["div.flex.flex-wrap", "Boshlang'ich:"],
                ["tfoot tr", "Davr oboroti"],
            ],
        },
        {
            "name": "accounts",
            "path": "/accounting/accounts",
            "wait": "Hisoblar rejasi",
            "steps": [["fill", "input[placeholder*='Kod yoki nom']", "60"]],
            "marks": [
                ["div.inline-flex.rounded-lg:has(> button)", "Hisoblar"],
                ["input[placeholder*='Kod yoki nom']", ""],
                ["tbody tr", "guruh"],
                ["tbody tr span.flex", "ap_suppliers"],
                ["tbody tr", "o'tkazmalar bor"],
                ["p", "Ishlatilgan hisob o'chirilmaydi"],
            ],
        },
        {
            "name": "roles",
            "path": "/accounting/accounts",
            "wait": "Hisoblar rejasi",
            "steps": [["click", "button", "Rollar"]],
            "marks": [["tbody tr", "ap_suppliers"], ["tbody tr:nth-child(4) select", ""]],
        },
        {
            "name": "rates",
            "path": "/accounting/accounts",
            "wait": "Hisoblar rejasi",
            "steps": [["click", "button", "Kurslar"]],
            "marks": [["table", "MANBA"], ["label", "Kurs, so'm"], ["button", "=Saqlash"], ["p", "Bugungi USD kursi"], ["p", "Markaziy bank kursi"]],
        },
    ]
