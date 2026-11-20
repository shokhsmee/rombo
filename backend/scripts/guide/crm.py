# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → CRM: the lead board, a lead card, analytics and settings, the client map, calls and Telegram
(frontend/src/modules/guide/chapters/crm.ts). Nothing here saves: forms and dialogs are opened and left."""

from django.db.models import Count

from apps.crm.models import Lead

# Telegram chats and accounts on the local DB are a real person's: names, avatars and messages are blurred
BLUR_TG = (
    "js",
    "(() => { const s = document.createElement('style'); s.textContent = "
    "'aside button img, aside button span.truncate, aside button span.size-10, .card span.text-sm.text-muted, .card input, .card p.rounded-md "
    "{ filter: blur(8px) }'; document.head.append(s) })()",
)


def ids() -> dict:
    """An open lead with tasks and calls (the richest card), and a call with a lead."""
    lead = (
        Lead.objects.filter(status="open", deleted_at__isnull=True)
        .annotate(t=Count("tasks", distinct=True), c=Count("calls", distinct=True))
        .order_by("-c", "-t", "pk")
        .first()
    )
    return {"lead": lead.pk if lead else None}


def _all_shots(ids: dict) -> list[dict]:
    lead = ids["lead"]
    return [
        {
            "name": "board",
            "path": "/crm",
            "wait": "Bog'lanildi",
            "marks": [
                ["div.flex-col.rounded-xl", "Bog'lanildi"],
                ["div.cursor-pointer.rounded-lg", "3 xonali"],
                ["button[title=\"Lid qo'shish\"]", ""],
                ["input[placeholder*='Nom, telefon']", ""],
                ["button[aria-label=\"Ro'yxat\"]", ""],
                ["a[title='Analitika']", ""],
                ["a[title='Sozlamalar']", ""],
                ["button", "Yangi lid"],
            ],
        },
        {
            "name": "card-hover",
            "path": "/crm",
            "wait": "Bog'lanildi",
            "steps": [["hover", "div.cursor-pointer.rounded-lg", "3 xonali"]],
            "crop": True,
            "marks": [["div.cursor-pointer.rounded-lg", "3 xonali"], ["div.cursor-pointer:hover button[title='Tez tahrirlash']", ""], ["div.cursor-pointer:hover button[title=\"Qo'ng'iroq qilish\"]", ""]],
        },
        {
            "name": "quick-add",
            "path": "/crm",
            "wait": "Bog'lanildi",
            "steps": [["click", "button[title=\"Lid qo'shish\"]", ""]],
            "crop": True,
            "marks": [
                ["form input[placeholder*='Nima kerak']", ""],
                ["form input[placeholder='Ism']", ""],
                ["form input[placeholder*='+998']", ""],
                ["form input[placeholder='Byudjet']", ""],
                ["form button", "Qo'shish"],
            ],
        },
        {
            "name": "filters",
            "path": "/crm",
            "wait": "Bog'lanildi",
            "steps": [["click", "button", "Filtr"]],
            "marks": [
                ["button", "Bugungi vazifalar"],
                ["button", "Filtr"],
                ["div.grid.rounded-xl.border", "HOLAT"],
                ["input[placeholder='Filtrni saqlash: nomi']", ""],
                ["button", "Ko'rsatish"],
            ],
        },
        {
            "name": "list",
            "path": "/crm",
            "wait": "Bog'lanildi",
            "steps": [["click", "button[aria-label=\"Ro'yxat\"]", ""], ["click", "tbody tr input[type=checkbox]", ""]],
            "marks": [["div.rounded-xl.border-accent", "ta tanlandi"], ["tbody tr input[type=checkbox]", ""], ["tbody tr select", ""], ["tfoot td", ""]],
        },
        {
            "name": "lead",
            "path": f"/crm/leads/{lead}",
            "wait": "Vazifalar",
            "marks": [
                ["button", "Loyiha ochish"],
                ["button", "→"],
                ["button", "Bosqich"],
                ["button", "Rad etish"],
                ["[aria-label='Bosqichlar']", ""],
                ["div.grid:has(> span)", "=Menejer"],
                ["div.grid:has(> span)", "=Telefon"],
            ],
        },
        {
            "name": "tasks",
            "path": f"/crm/leads/{lead}",
            "wait": "Vazifalar",
            "scroll": "Vazifalar",
            "crop": True,
            "marks": [
                ["section select", ""],
                ["section input[placeholder*='Nima qilish']", ""],
                ["section input[type='datetime-local']", ""],
                ["section button", "Ertaga 10:00"],
                ["section input[aria-label='Bajarildi']", ""],
            ],
        },
        {
            "name": "convert",
            "path": f"/crm/leads/{lead}",
            "wait": "Vazifalar",
            "steps": [["click", "button", "Loyiha ochish"]],
            "crop": True,
            "marks": [["[role=dialog] p", "Loyiha qoralama"], ["[role=dialog] input", ""], ["[role=dialog] button", "Loyiha ochish"]],
        },
        {
            "name": "lost",
            "path": f"/crm/leads/{lead}",
            "wait": "Vazifalar",
            "steps": [["click", "button", "Rad etish"]],
            "crop": True,
            "marks": [["[role=dialog] div.flex-wrap", ""], ["[role=dialog] input", ""], ["[role=dialog] button", "Rad etish"]],
        },
        {
            "name": "analytics",
            "path": "/crm/analytics",
            "wait": "Yangi lidlar",
            "marks": [["div.inline-flex", "Voronka"], ["div.inline-flex", "90 kun"], ["div.rounded-xl", "Konversiya"], ["section", "Kunlar bo'yicha"], ["section", "Bog'lanildi"]],
        },
        {
            "name": "settings",
            "path": "/crm/settings",
            "wait": "CRM sozlamalari",
            "marks": [["div.inline-flex", "Lid maydonlari"], ["input[placeholder='Yangi voronka']", ""], ["div.grid", "ISH BOSQICHLARI"], ["input[placeholder='+ yangi bosqich']", ""], ["div.grid", "TIZIM BOSQICHLARI"], ["div.card", "Rad etish sabablari"]],
        },
        {
            "name": "settings-distribution",
            "path": "/crm/settings?tab=distribution",
            "wait": "Navbat bilan",
            "crop": True,
            "marks": [["button", "Navbat bilan"], ["button", "Eng kam yuklanganga"], ["div.grid", "NAVBATDAGI XODIMLAR"]],
        },
        {
            "name": "map",
            "path": "/crm/map",
            "wait": "ta mijoz xaritada",
            "steps": [["wait", 2500]],
            "marks": [["input[placeholder*='Nom, telefon']", ""], ["div.inline-flex", "Rang: turi"], ["section.card", "ta mijoz xaritada"], ["section.relative", ""], ["button", "Hammasi"], ["ul", ""]],
        },
        {
            "name": "calls",
            "path": "/telephony?period=month",
            "wait": "Kiruvchi",
            "marks": [
                ["button", "O'tkazib yuborildi"],
                ["div.inline-flex", "7 kun"],
                ["input[placeholder*='Raqam, mijoz']", ""],
                ["label", "Faqat meniki"],
                ["tbody tr a", "LD-"],
                ["th", "YOZUV"],
                ["tbody tr button[aria-label=\"Qo'ng'iroq qilish\"]", ""],
                ["a", "Sozlamalar"],
            ],
        },
        {
            "name": "call-note",
            "path": "/telephony?period=month",
            "wait": "Kiruvchi",
            "steps": [["click", "tbody tr", "LD-"]],
            "crop": True,
            "marks": [["[role=dialog] textarea", ""], ["[role=dialog] a", "lidini ochish"], ["[role=dialog] button", "Saqlash"]],
        },
        {
            "name": "tel-rules",
            "path": "/telephony/settings?tab=rules",
            "wait": "Noma'lum raqam",
            "marks": [["div.grid:has(> span)", "Kiruvchi"], ["div.grid:has(> span)", "Ma'lum mijoz"], ["div.grid:has(> span)", "Mas'ul"], ["div.grid:has(> span)", "Qayta qo'ng'iroq"], ["div.grid:has(> span)", "Qalqib chiquvchi"], ["div.grid:has(> span)", "Yoqilgan (brauzer"]],
        },
        {
            "name": "tel-connections",
            "path": "/telephony/settings",
            "wait": "Ulanishlar",
            "marks": [["div.card button", "IP-telefoniya"], ["div.card button", "Yana"], ["div.card button", "Ulash"]],
        },
        {
            "name": "tel-ext",
            "path": "/telephony/settings?tab=people",
            "wait": "ichki raqami",
            "steps": [["click", "button", "Qo'shish"], ["click", "[role=dialog] label", "Brauzer telefoni"]],
            "crop": True,
            "marks": [["[role=dialog] label", "Foydalanuvchi"], ["[role=dialog] label", "Ichki raqam"], ["[role=dialog] label", "Brauzer telefoni"], ["[role=dialog] label", "SIP login"], ["[role=dialog] label", "SIP parol"]],
        },
        {
            "name": "tg-accounts",
            "path": "/telegram/accounts",
            "wait": "Akkaunt qo'shish",
            "steps": [list(BLUR_TG)],
            "marks": [["nav", "Akkauntlar"], ["button", "Akkaunt qo'shish"], ["div.card span", "Ulangan"], ["label", "Yangi shaxsiy chat"], ["label", "va lid"], ["button", "Uzish"]],
        },
        {
            "name": "tg-chats",
            "path": "/telegram",
            "wait": "Barchasi",
            "steps": [list(BLUR_TG), ["wait", 1500]],
            "marks": [["aside input", ""], ["aside div.inline-flex", "Shaxsiy"], ["aside button.border-b", ""], ["section, div.place-items-center", "Chatni tanlang"]],
        },
    ]


# Not in the guide: Telegram, telephony, company requisites and Claude tokens show real accounts, numbers or keys.
LEFT_OUT = {'calls','call-note','tel-connections','tel-rules','tel-ext','tg-accounts','tg-chats'}


def shots(ids: dict) -> list[dict]:
    return [s for s in _all_shots(ids) if s["name"] not in LEFT_OUT]
