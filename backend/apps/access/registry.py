"""Single source of truth for every page (resource) the ERP exposes.

Adding a module? Add its page here. RolePermission rows reference `key`.
The frontend reads this list from GET /access/pages/ to build the role matrix,
and uses the same keys to hide menu items and buttons.

Keys are permanent identifiers: rename the label freely, never the key.
"""

from dataclasses import dataclass
from enum import StrEnum


class Action(StrEnum):
    VIEW = "view"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


ALL_ACTIONS = (Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE)
VIEW_ONLY = (Action.VIEW,)


@dataclass(frozen=True)
class PageDef:
    key: str
    label: str
    group: str
    actions: tuple[Action, ...] = ALL_ACTIONS
    planned: bool = False  # shown in the matrix so roles can be prepared before the module ships


class Pages:
    """Typed constants: views write `page_key = Pages.CLIENTS`, not the string."""

    DASHBOARD = "dashboard"
    PROJECTS = "projects"
    CLIENTS = "clients"
    PROCUREMENT = "procurement"
    MRP = "mrp"
    EMPLOYEES = "employees"
    USERS = "users"
    ROLES = "roles"
    REFERENCES = "references"
    PRICING = "pricing"
    COMPANY = "company"


PAGES: tuple[PageDef, ...] = (
    PageDef(Pages.DASHBOARD, "Bosh sahifa", "Umumiy", VIEW_ONLY),
    PageDef(Pages.PROJECTS, "Loyihalar", "Savdo"),
    PageDef(Pages.CLIENTS, "Mijozlar", "Savdo"),
    PageDef(Pages.PROCUREMENT, "Xaridlar", "Ta'minot", planned=True),
    PageDef(Pages.MRP, "MRP — material rejalash", "Ishlab chiqarish", planned=True),
    PageDef(Pages.EMPLOYEES, "Xodimlar", "Xodimlar"),
    PageDef(Pages.USERS, "Foydalanuvchilar", "Sozlamalar"),
    PageDef(Pages.ROLES, "Rollar va ruxsatlar", "Sozlamalar"),
    PageDef(Pages.REFERENCES, "Ma'lumotnomalar", "Sozlamalar"),
    PageDef(Pages.PRICING, "Narxlar", "Sozlamalar"),
    PageDef(Pages.COMPANY, "Kompaniya rekvizitlari", "Sozlamalar", (Action.VIEW, Action.UPDATE)),
)

PAGE_BY_KEY = {p.key: p for p in PAGES}

assert {v for k, v in vars(Pages).items() if k.isupper()} == set(PAGE_BY_KEY), "Pages and PAGES out of sync"
