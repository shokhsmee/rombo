# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Sozlamalar: users and roles, pick lists, price lists, company, approval steps, Claude, specs and ideas
(frontend/src/modules/guide/chapters/settings.ts). Only forms and dialogs are opened — nothing is saved, no token is made."""

from django.conf import settings as dj

from apps.access.models import Role
from apps.pricing.models import PriceList
from apps.specs.models import SpecDocument
from apps.users.models import User

# token prefixes in the Claude page never reach a picture
MASK_TOKENS = ["js", "(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { if (/rmb_/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/rmb_[\\w-]*/g, 'rmb_…') } })()"]

# the company's own requisites (director, phone, bank) are swapped for made-up ones in the page; the DB is not touched
MASK_COMPANY = ["js", "(() => { const set = (l, v) => { for (const r of document.querySelectorAll('div.grid')) { const s = r.querySelector(':scope > span'); if (s && s.textContent.trim() === l) { const i = r.querySelector('input'); if (i) i.value = v } } }; set('Direktor', 'Karimov Akmal Valiyevich'); set('Direktor (qisqa)', 'Karimov A.'); set('Shahar', 'Samarqand'); set('Manzil', 'Amir Temur 1'); set('Telefon', '+998 90 123 45 67'); set('Hisob raqami', '20208000000000000001'); set('MFO', '00000'); set('STIR (INN)', '300000000') })()"]


def ids() -> dict:
    user = User.objects.filter(is_active=True, is_superuser=False, roles__isnull=False).exclude(username=dj.SEED_ADMIN_USERNAME).order_by("pk").first()
    role = Role.objects.filter(name="Savdo menejeri").first() or Role.objects.order_by("pk").first()
    pl = PriceList.objects.filter(is_active=True).order_by("pk").first()
    doc = SpecDocument.objects.filter(kind="spec", ref="access-control").first() or SpecDocument.objects.filter(kind="spec").order_by("pk").first()
    return {"user": user.pk if user else None, "role": role.pk if role else None, "pricelist": pl.pk if pl else None, "doc": doc.pk if doc else None}


def _all_shots(ids: dict) -> list[dict]:
    u, r, pl, doc = ids["user"], ids["role"], ids["pricelist"], ids["doc"]
    return [
        {
            "name": "home",
            "path": "/settings",
            "wait": "Kamdan-kam",
            "menu": True,
            "marks": [
                ["aside a", "Sozlamalar"],
                ["main a", "Foydalanuvchilar"],
                ["main a", "Rollar va ruxsatlar"],
                ["main section", "TIZIM"],
            ],
        },
        {
            "name": "users",
            "path": "/settings/users",
            "wait": "Tizimga kiradigan",
            "marks": [
                ["header a", "Yangi foydalanuvchi"],
                ["div.w-52", ""],
                ["div.inline-flex.rounded-lg:has(> button)", "Bloklangan"],
                ["tbody tr td div.flex", "Savdo menejeri"],
                ["tbody tr td span", "=Faol"],
            ],
        },
        {
            "name": "user-new",
            "path": "/settings/users/new",
            "wait": "Yangi foydalanuvchi",
            "marks": [
                ["div.grid:has(> span)", "Login"],
                ["div.grid:has(> span)", "Parol"],
                ["div.grid:has(> span)", "Rollar"],
                ["section", "Sahifalarga kirish"],
                ["button", "Saqlash"],
            ],
        },
        {
            "name": "user",
            "path": f"/settings/users/{u}",
            "wait": "Kirish huquqi",
            "marks": [
                ["label", "=Faol"],
                ["div.grid:has(> span)", "Rollar"],
                ["button", "Parolni tiklash"],
                ["section", "Sahifalarga kirish"],
            ],
        },
        {
            "name": "roles",
            "path": "/settings/roles",
            "wait": "Rol — har bir sahifa",
            "marks": [["header a", "Yangi rol"], ["tbody tr span", "tizim"], ["tbody tr", "Savdo menejeri"]],
        },
        {
            "name": "role",
            "path": f"/settings/roles/{r}",
            "wait": "Sahifalarga ruxsat",
            "scroll": "Sahifalarga ruxsat",
            "marks": [
                ["thead tr", ""],
                ["tbody tr td.t-label", ""],
                ["tbody tr:nth-child(4) td:last-child", ""],
                ["tbody tr td", "·"],
            ],
        },
        {
            "name": "references",
            "path": "/settings/references",
            "wait": "Ma'lumotnomalar",
            "marks": [
                ["div.inline-flex.rounded-lg:has(> button)", "Sotuv kanali"],
                ["section header", ""],
                ["section label", ""],
                ["section button[aria-label=\"Nomini o'zgartirish\"]", ""],
                ["section button[aria-label=\"O'chirish\"]", ""],
                ["section form", "Qo'shish"],
            ],
        },
        {
            "name": "pricing",
            "path": "/settings/pricing",
            "wait": "Narx ro'yxati",
            "crop": True,
            "marks": [["header a", "Yangi narx ro'yxati"], ["tbody tr", "seriya"], ["th", "QATORLAR"]],
        },
        {
            "name": "pricelist",
            "path": f"/settings/pricing/{pl}",
            "wait": "Komplektlovchilar",
            "marks": [
                ["div.grid:has(> span)", "Nomi"],
                ["div.grid:has(> span)", "Buyurtma turi"],
                ["div.grid:has(> span)", "Valyuta"],
                ["div.grid:has(> span)", "Holat"],
                ["tbody tr input[inputmode=decimal]", ""],
                ["tbody tr td div.flex", ""],
            ],
        },
        {
            "name": "company",
            "path": "/settings/company",
            "wait": "Kompaniya rekvizitlari",
            "height": 1400,
            "steps": [MASK_COMPANY],
            "marks": [
                ["div.grid:has(> span)", "Nomi"],
                ["div.grid:has(> p)", "BANK"],
                ["div.grid:has(> p)", "SHARTNOMA SHARTLARI"],
                ["label", "QQS to'lovchi"],
                ["div.grid:has(> span)", "Davr yopilgan sana"],
            ],
        },
        {
            "name": "approval",
            "path": "/settings/approval-steps",
            "wait": "Tasdiqlash bosqichlari",
            "marks": [["button", "Bosqich qo'shish"], ["tbody tr", "Ta'minot boshlig'i"], ["tbody tr", "Direktor"], ["tbody tr button[aria-label=Tahrirlash]", ""]],
        },
        {
            "name": "approval-step",
            "path": "/settings/approval-steps",
            "wait": "Tasdiqlash bosqichlari",
            "steps": [["click", "button", "Bosqich qo'shish"]],
            "crop": True,
            "marks": [["[role=dialog] label", "Tartib"], ["[role=dialog] label", "Kim tasdiqlaydi"], ["[role=dialog] label", "=Faol"]],
        },
        {
            "name": "claude",
            "path": "/system/claude",
            "wait": "Mening tokenlarim",
            "steps": [MASK_TOKENS],
            "marks": [
                ["button", "Yangi token"],
                ["div.inline-flex.rounded-lg:has(> button)", "claude.ai / Desktop"],
                ["ol", "Connectors"],
                ["p", "Faqat o'qish"],
                ["section", "Mening tokenlarim"],
            ],
        },
        {
            "name": "claude-token",
            "path": "/system/claude",
            "wait": "Mening tokenlarim",
            "steps": [["click", "button", "Yangi token"], MASK_TOKENS],
            "crop": True,
            "marks": [["[role=dialog] label", "Nomi"], ["[role=dialog] label", "Ruxsat"], ["[role=dialog] label", "Muddati"], ["[role=dialog] button", "Yaratish"]],
        },
        {
            "name": "specs",
            "path": f"/system/specs?doc={doc}",
            "wait": "Spetsifikatsiyalar",
            "marks": [
                ["aside input", ""],
                ["aside details", "SPETSIFIKATSIYALAR"],
                ["span", "Izchil"],
                ["article", ""],
            ],
        },
        {
            "name": "idea",
            "path": "/system/ideas/new",
            "wait": "Yangi taklif",
            "marks": [
                ["div.grid:has(> span)", "Sarlavha"],
                ["div.grid:has(> span)", "Turi"],
                ["div.grid:has(> span)", "Muhimlik"],
                ["div.grid:has(> span)", "Muammo"],
                ["button", "Saqlash"],
            ],
        },
    ]


# Not in the guide: Telegram, telephony, company requisites and Claude tokens show real accounts, numbers or keys.
LEFT_OUT = {'claude','claude-token','specs','idea','company'}


def shots(ids: dict) -> list[dict]:
    return [s for s in _all_shots(ids) if s["name"] not in LEFT_OUT]
