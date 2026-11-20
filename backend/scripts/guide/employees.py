# ruff: noqa: E501 — the shot list reads better unwrapped
"""Qo'llanma → Xodimlar: the staff list and the employee card (frontend/src/modules/guide/chapters/employees.ts)."""

from apps.employees.models import Employee


def ids() -> dict:
    """A working employee with a position and a department — the card shows every block filled."""
    e = (Employee.objects.filter(status="active").exclude(position="").exclude(department="").order_by("pk").first()
         or Employee.objects.order_by("pk").first())
    return {"employee": e.pk if e else None}


def shots(ids: dict) -> list[dict]:
    e = ids["employee"]
    return [
        {
            "name": "list",
            "path": "/employees",
            "wait": "XD-",
            "height": 800,
            "marks": [
                ["main header a", "Yangi xodim"],
                ["input[placeholder*='lavozim']", ""],
                ["main div.inline-flex:has(> button)", "Ishlamoqda"],
                ["main select", "Bo'lim"],
                ["tbody td div.flex", "XD-"],
                ["th", "=LOGIN"],
            ],
        },
        {
            "name": "card",
            "path": f"/employees/{e}",
            "wait": "Tarix",
            "height": 900,
            "marks": [
                ["div[class*='min-h-[54px]'] div.overflow-hidden", "Ishlamoqda"],
                ["div.grid:has(> span)", "Familiya"],
                ["div.grid:has(> span)", "Ism"],
                ["div.grid:has(> span)", "Bo'lim"],
                ["div.grid:has(> span)", "Lavozim"],
                ["div.grid:has(> span)", "Ishga kirgan"],
                ["div.grid:has(> span)", "Tizim logini"],
            ],
        },
    ]
