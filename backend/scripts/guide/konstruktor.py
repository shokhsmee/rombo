# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Chizmalar (Konstruktor): drawing windows on a Loyiha, the price, the calculation and the cut plan
(frontend/src/modules/guide/chapters/konstruktor.ts). Shot on a draft Loyiha of the local demo that has drawings."""

from apps.konstruktor.models import Construction, ProfileSystem


def ids() -> dict:
    # the construction with the most cells shows imposts and sashes; its Loyiha is a draft, so it can be edited
    drawn = Construction.objects.filter(project__status="draft").order_by("pk")
    c = max(drawn, key=lambda x: len(x.design.get("root", {}).get("cells", [])), default=None)
    calc = c.project.calcs.order_by("pk").first() if c else None
    system = ProfileSystem.objects.order_by("pk").first()
    return {"project": c.project_id if c else None, "construction": c.pk if c else None,
            "calc": calc.pk if calc else None, "system": system.pk if system else None}


# a click on the n-th cell / impost of the drawing (SVG: React's onClick listens on the root, so a bubbling click)
def _cell(n: int) -> list:
    return ["js", f"document.querySelectorAll('svg[aria-label^=Konstruksiya] g.cursor-pointer')[{n}].dispatchEvent(new MouseEvent('click', {{bubbles: true}}))"]


def _impost(n: int) -> list:
    return ["js", f"document.querySelectorAll('svg[aria-label^=Konstruksiya] rect.cursor-pointer')[{n}].dispatchEvent(new MouseEvent('click', {{bubbles: true}}))"]


def shots(ids: dict) -> list[dict]:
    p, c, calc, system = ids["project"], ids["construction"], ids["calc"], ids["system"]
    return [
        {
            "name": "panel",
            "path": f"/projects/{p}",
            "wait": "Buyurtma №",
            "scroll": "Chizmalar — konstruktor",
            "marks": [
                ["a", "Yangi konstruksiya"],
                ["div.group", "KS-"],
                ["button", "Hisob-kitobga o'tkazish"],
                ["button", "Raskroy"],
                ["div.ml-auto", "Taxminiy"],
            ],
        },
        {
            "name": "templates",
            "path": f"/projects/{p}/constructions/new",
            "wait": "Shablon tanlang",
            "marks": [["[role=dialog] button", "Gluxoy"], ["[role=dialog] button", "Uch qism"], ["[role=dialog] button", "Balkon bloki"], ["[role=dialog] button", "Eshik"]],
        },
        {
            "name": "editor",
            "path": f"/projects/{p}/constructions/{c}",
            "wait": "Eni, mm",
            "marks": [
                ["label", "Eni, mm"],
                ["label", "Bo'yi, mm"],
                ["label", "Soni"],
                ["svg[aria-label^=Konstruksiya]", ""],
                ["button", "Shablon"],
                ["div", "Narx (taxminiy)"],
            ],
        },
        {
            "name": "cell",
            "path": f"/projects/{p}/constructions/{c}",
            "wait": "Eni, mm",
            "steps": [_cell(0)],
            "marks": [
                ["svg[aria-label^=Konstruksiya]", ""],
                ["div.grid", "Ochilishi"],
                ["div.flex", "Lup tomoni"],
                ["div.grid", "To'ldirish"],
                ["div.grid", "Bo'lish"],
            ],
        },
        {
            "name": "impost",
            "path": f"/projects/{p}/constructions/{c}",
            "wait": "Eni, mm",
            "steps": [_impost(0)],
            "marks": [["svg[aria-label^=Konstruksiya] rect.fill-accent", ""], ["section", "QISMLAR"]],
        },
        {
            "name": "result",
            "path": f"/projects/{p}/constructions/{c}",
            "wait": "Eni, mm",
            "steps": [["click", "button", "Detallar"]],
            "scroll": "Hisob",
            "marks": [["button", "Narx"], ["button", "Detallar"], ["button", "Oynalar"], ["section", "Profil tizimi"]],
        },
        {
            "name": "cut-plan",
            "path": f"/projects/{p}/cut-plan",
            "wait": "Profil kesish xaritasi",
            "marks": [["button", "Chop etish"], ["div", "Xlistlar"], ["div.items-center", "#1"], ["div", "qoldiq"], ["div", "chiqindi"]],
        },
        {
            "name": "calc-drawing",
            "path": f"/projects/{p}/calcs/{calc}",
            "wait": "Hisob-kitob",
            "marks": [["tbody tr", "chizmadan"], ["tbody tr span", "chizmadan"], ["aside div.grid", "chizmadan to'ldirildi"]],
        },
        {
            "name": "system",
            "path": f"/settings/profile-systems/{system}",
            "wait": "Xlist va arra",
            "marks": [["div.grid:has(> span)", "Narx ro'yxati"], ["label", "Sex hali tasdiqlamagan"], ["div.grid:has(> span)", "Xlist uzunligi"], ["div.grid:has(> span)", "Arra qalinligi"], ["[aria-label=\"O'lchamlar sxemasi\"]", ""]],
        },
    ]
