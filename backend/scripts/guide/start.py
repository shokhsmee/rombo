# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Boshlash: signing in, the menu, the dashboard, how every list and every record page works
(frontend/src/modules/guide/chapters/start.ts). Lists and records are shown on Mijozlar of the local demo."""

from django.db.models import Count

from apps.chatter.models import Message
from apps.clients.models import Client


def ids() -> dict:
    """A client whose history has a field change and who has Loyihalar — the record page shows all its parts."""
    tracked = Message.objects.filter(model="clients.client", kind="track").values_list("res_id", flat=True)
    c = (Client.objects.filter(pk__in=list(tracked), kind="individual").annotate(n=Count("projects"))
         .order_by("-n", "pk").first())
    return {"client": c.pk if c else None, "code": c.code if c else ""}


# the sidebar and the list page carry the same element names on every page
_LOGOUT = ["js", "window.dispatchEvent(new Event('rombo:logout'))"]


def shots(ids: dict) -> list[dict]:
    c, code = ids["client"], ids["code"]
    return [
        {
            "name": "login",
            "path": "/",
            "wait": "",
            "steps": [_LOGOUT, ["wait", 1200]],
            "menu": True,
            "height": 440,
            "marks": [["input[aria-label='Login']", ""], ["input[aria-label='Parol']", ""], ["button[aria-label=\"Parolni ko'rsatish\"]", ""], ["button[type=submit]", "Kirish"]],
        },
        {
            "name": "menu",
            "path": "/clients",
            "wait": "Mijozlar",
            "menu": True,
            "crop": True,
            "marks": [
                ["aside nav a", "Bosh sahifa"],
                ["aside nav button", "Savdo"],
                ["aside nav a", "Mijozlar"],
                ["aside nav button", "Ta'minot"],
                ["aside nav a", "Sozlamalar"],
                ["aside nav a", "Qo'llanma"],
                ["aside div:has(> button[aria-label='Tungi'])", ""],
            ],
        },
        {
            "name": "topbar",
            "path": "/",
            "wait": "Ochish",
            "steps": [["click", "header button", "Superuser"]],
            "crop": True,
            "marks": [["header a", "Yangi loyiha"], ["header button", "Superuser"], [".pop button", "Mening hisobim"], [".pop button", "Chiqish"]],
        },
        {
            "name": "dashboard",
            "path": "/",
            "wait": "Ochish",
            "marks": [
                ["main div.inline-flex:has(> button)", "Hammasi"],
                ["section.card header", "Savdo"],
                ["section.card button", "Jarayondagi buyurtmalar"],
                ["section.card header a", "Ochish"],
            ],
        },
        {
            "name": "list",
            "path": "/clients?sort=name",
            "wait": "MJ-",
            "height": 1150,
            "marks": [
                ["input[placeholder*='STIR']", ""],
                ["main div.inline-flex:has(> button)", "Barchasi"],
                ["main select", "Hudud"],
                ["th button", "MIJOZ"],
                ["th input[type=checkbox]", ""],
                ["button", "Excel"],
                ["main div.justify-end:has(button[aria-label='Keyingi sahifa'])", ""],
            ],
        },
        {
            "name": "bulk",
            "path": "/clients",
            "wait": "MJ-",
            "steps": [
                ["js", "document.querySelectorAll('tbody input[type=checkbox]')[0].click()"],
                ["js", "document.querySelectorAll('tbody input[type=checkbox]')[1].click()"],
            ],
            "crop": True,
            "marks": [["tbody tr.bg-accent-soft\\/50 input", ""], ["main div.sticky b", "ta tanlandi"], ["main div.sticky button", "Nofaol qilish"], ["main div.sticky button", "Tozalash"]],
        },
        {
            "name": "excel",
            "path": "/clients",
            "wait": "MJ-",
            "steps": [["js", "document.querySelectorAll('tbody input[type=checkbox]')[0].click()"], ["click", "button", "Excel"]],
            "crop": True,
            "marks": [
                [".pop button", "Ro'yxatni yuklab olish"],
                [".pop button", "Tanlanganlarni yuklab olish"],
                [".pop button", "Excel'dan import"],
                [".pop button", "Import shabloni"],
            ],
        },
        {
            "name": "import",
            "path": "/clients",
            "wait": "MJ-",
            "steps": [["click", "button", "Excel"], ["click", ".pop button", "Excel'dan import"]],
            "marks": [
                ["[role=dialog] div.flex-wrap", "Nomi"],
                ["[role=dialog] button", "Faylni tanlang"],
                ["[role=dialog] button", "Shablon"],
                ["[role=dialog] button", "Tekshirish"],
            ],
        },
        {
            "name": "record",
            "path": "/clients",
            "wait": "MJ-",
            "steps": [["click", "tbody tr", code], ["wait", 800]],
            "marks": [
                ["nav[aria-label=\"Yo'l\"]", ""],
                ["main div.ml-auto:has(button[aria-label='Keyingi'])", ""],
                ["div[class*='min-h-[54px]']", ""],
                ["main section h1", ""],
                ["main button.press.h-11", "Loyihalar"],
                ["aside section", "Tarix"],
            ],
        },
        {
            "name": "dirty",
            "path": f"/clients/{c}",
            "wait": "Tarix",
            "steps": [["fill", "div.grid:has(> span:has-text('Qayerdan kelgan')) input", "Instagram"]],
            "crop": True,
            "marks": [["button[type=submit]", "Saqlash"], ["div[class*='min-h-[54px]'] button", "Bekor qilish"], ["div.grid:has(> span)", "Qayerdan kelgan"]],
        },
        {
            "name": "history",
            "path": f"/clients/{c}",
            "wait": "Tarix",
            "crop": True,
            "marks": [
                ["aside textarea", ""],
                ["aside button", "Izohlar"],
                ["aside button", "O'zgarishlar"],
                ["aside li", "→"],
                ["aside button[aria-label='Tarixni yashirish']", ""],
            ],
        },
    ]
