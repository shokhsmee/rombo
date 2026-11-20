# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Servis: service requests from a call to closing, and the masters
(frontend/src/modules/guide/chapters/service.ts). Dialogs and menus are opened and left — nothing is saved."""

from django.db.models import Count

from apps.maintenance.models import Master, ServiceRequest


def _first(**kw) -> int | None:
    r = ServiceRequest.objects.filter(**kw).order_by("pk").first()
    return r.pk if r else None


def ids() -> dict:
    """A new request without a master, one a master accepted, a closed one (rated if any), the busiest master."""
    closed = ServiceRequest.objects.filter(status="closed").order_by("rating", "pk").last()
    master = Master.objects.annotate(n=Count("requests")).order_by("-n", "pk").first()
    return {
        "new": _first(status="new", master__isnull=True),
        "accepted": _first(status="accepted") or _first(status="assigned"),
        "closed": closed.pk if closed else None,
        "master": master.pk if master else None,
    }


def shots(ids: dict) -> list[dict]:
    new, acc, closed, master = ids["new"], ids["accepted"], ids["closed"], ids["master"]
    return [
        {
            "name": "list",
            "path": "/service",
            "wait": "SV-",
            "marks": [
                ["a", "Yangi ariza"],
                ["button", "Ochiq"],
                ["button", "Ustaga berildi"],
                ["input[placeholder*='Kod, mijoz']", ""],
                ["label", "Kafolat"],
                ["tbody tr", "SV-"],
            ],
        },
        {
            "name": "new",
            "path": "/service/new",
            "wait": "Yangi ariza",
            "marks": [
                ["div.grid:has(> span)", "Mijoz"],
                ["div.grid:has(> span)", "Loyiha"],
                ["div.grid:has(> span)", "Lokatsiya"],
                ["div.grid:has(> span)", "Turi"],
                ["div.grid:has(> span)", "Kafolat"],
                ["div.grid:has(> span)", "Tavsif"],
                ["button", "Saqlash"],
            ],
        },
        {
            "name": "card",
            "path": f"/service/{new}",
            "wait": "Servis arizasi",
            "marks": [
                ["button", "Ustaga berish"],
                ["button", "Boshqa"],
                ["[aria-label='Bosqichlar']", ""],
                ["button", "Usta"],
                ["span", "mijoz botda"],
            ],
        },
        {
            "name": "assign",
            "path": f"/service/{new}",
            "wait": "Servis arizasi",
            "steps": [["click", "button", "Ustaga berish"]],
            "crop": True,
            "marks": [["[role=dialog] label", "Usta"], ["[role=dialog] label", "Kelish vaqti"], ["[role=dialog] p", "botda"], ["[role=dialog] button", "Berish"]],
        },
        {
            "name": "status-more",
            "path": f"/service/{acc}",
            "wait": "Servis arizasi",
            "steps": [["click", "button", "Boshqa"]],
            "crop": True,
            "marks": [["button", "Ishni boshlash"], ["button", "Ustani o'zgartirish"], [".pop", ""]],
        },
        {
            "name": "accepted",
            "path": f"/service/{acc}",
            "wait": "Servis arizasi",
            "scroll": "Usta va vaqt",
            "height": 1150,
            "marks": [["div.grid:has(> span)", "Kelish vaqti"], ["div.grid:has(> span)", "Bosqichlar"], ["div.grid:has(> span):has(img)", ""], ["div.grid:has(> span)", "Bajarilgan ish"]],
        },
        {
            "name": "cancel",
            "path": f"/service/{acc}",
            "wait": "Servis arizasi",
            "steps": [["click", "button", "Boshqa"], ["click", ".pop button", "Bekor qilish"]],
            "crop": True,
            "marks": [["[role=dialog] p", "Sabab"], ["[role=dialog] textarea", ""], ["[role=dialog] button", "Bekor qilish"]],
        },
        {
            "name": "closed",
            "path": f"/service/{closed}",
            "wait": "Servis arizasi",
            "scroll": "Natija",
            "marks": [["div.rounded-xl", "o'zgartirib bo'lmaydi"], ["div.grid:has(> span)", "Usta hisoboti"], ["div.grid:has(> span)", "Mijoz bahosi"], ["div.grid:has(> span)", "Mijoz fikri"]],
        },
        {
            "name": "masters",
            "path": "/service/masters",
            "wait": "US-",
            "marks": [["a", "Yangi usta"], ["div.inline-flex", "Nofaol"], ["th", "TELEGRAM"], ["th", "OCHIQ ISHLAR"], ["th", "BAHO"]],
        },
        {
            "name": "master",
            "path": f"/service/masters/{master}",
            "wait": "Usta ·",
            "marks": [
                ["button", "Ochiq ishlar"],
                ["button", "Bajarilgan"],
                ["div.grid:has(> span)", "Telefon"],
                ["div.grid:has(> span)", "Ixtisoslik"],
                ["div.grid:has(> span)", "Ish beriladi"],
                ["div.grid:has(> span)", "Telegram"],
            ],
        },
    ]
