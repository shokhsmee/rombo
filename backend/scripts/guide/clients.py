# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Mijozlar: the clients list and the client card (frontend/src/modules/guide/chapters/clients.ts)."""

from django.db.models import Count

from apps.clients.models import Client


def ids() -> dict:
    """An individual with Loyihalar and a map point; a dealer (a company-like card with bank details)."""
    person = (Client.objects.filter(kind="individual", latitude__isnull=False).annotate(n=Count("projects"))
              .order_by("-n", "pk").first())
    dealer = Client.objects.filter(kind="dealer").order_by("pk").first()
    return {"person": person.pk if person else None, "dealer": dealer.pk if dealer else None}


def shots(ids: dict) -> list[dict]:
    p, d = ids["person"], ids["dealer"]
    return [
        {
            "name": "list",
            "path": "/clients",
            "wait": "MJ-",
            "marks": [
                ["main header a", "Yangi mijoz"],
                ["main div.inline-flex:has(> button)", "Barchasi"],
                ["main select", "Hudud"],
                ["main input[placeholder='Menejer']", ""],
                ["main select", "Holat"],
                ["tbody td div.min-w-48", "STIR"],
            ],
        },
        {
            "name": "card",
            "path": f"/clients/{p}",
            "wait": "Tarix",
            "marks": [
                ["div.grid:has(> span)", "Turi"],
                ["div.grid:has(> span)", "F.I.O."],
                ["div.grid:has(> span)", "STIR"],
                ["div.grid:has(> span)", "Mas'ul menejer"],
                ["div.grid:has(> span)", "Segment"],
                ["main button.press.h-11", "Loyihalar"],
                ["main button.press.h-11", "To'lovlar"],
                ["div.grid:has(> span)", "=Pasport"],
            ],
        },
        {
            "name": "location",
            "path": f"/clients/{p}",
            "wait": "Tarix",
            "scroll": "Lokatsiya",
            "crop": True,
            "marks": [
                ["input[placeholder*='Kenglik']", ""],
                [".leaflet-container", ""],
                ["a", "Xaritada ochish"],
                ["button[aria-label='Lokatsiyani olib tashlash']", ""],
            ],
        },
        {
            "name": "company",
            "path": f"/clients/{d}",
            "wait": "Tarix",
            "marks": [
                ["div.grid:has(> span)", "Turi"],
                ["div.grid:has(> span)", "Tashkilot nomi"],
                ["div.grid:has(> span)", "Aloqa shaxsi"],
                ["div.grid:has(> p.t-label)", "BANK REKVIZITLARI"],
            ],
            "scroll": "Diler / hamkor ·",
            "height": 1500,
        },
        {
            "name": "projects",
            "path": f"/clients/{p}",
            "wait": "Tarix",
            "steps": [["wait", 800]],
            "crop": True,
            "marks": [["section:has(> div > h2) h2", "Loyihalar"], ["section:has(> div > h2) a", "LY-"], ["section:has(> div > h2) a span.rounded-full", ""]],
            "height": 1450,
        },
    ]
