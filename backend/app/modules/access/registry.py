"""Single source of truth for every page (resource) the ERP exposes.

Adding a module? Add its page here. Role permission rows reference `key`.
The frontend reads this list from GET /access/pages to build the role matrix,
and uses the same keys to hide menu items / buttons.

Keys are permanent identifiers: rename the label freely, never the key.
"""

from dataclasses import dataclass
from enum import StrEnum


class Action(StrEnum):
    VIEW = "view"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


@dataclass(frozen=True)
class PageDef:
    key: str
    label: str
    group: str
    actions: tuple[Action, ...] = (Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE)
    planned: bool = False  # visible in the matrix so roles can be prepared before the module ships


VIEW_ONLY = (Action.VIEW,)

PAGES: tuple[PageDef, ...] = (
    PageDef("dashboard", "Bosh sahifa", "Umumiy", VIEW_ONLY),
    # Sales
    PageDef("projects", "Loyihalar", "Savdo"),
    PageDef("clients", "Mijozlar", "Savdo"),
    # Supply chain (next milestones)
    PageDef("procurement", "Xaridlar", "Ta'minot", planned=True),
    PageDef("mrp", "MRP / Material rejalash", "Ishlab chiqarish", planned=True),
    # HR
    PageDef("employees", "Xodimlar", "Xodimlar"),
    # Administration
    PageDef("users", "Foydalanuvchilar", "Sozlamalar"),
    PageDef("roles", "Rollar va ruxsatlar", "Sozlamalar"),
)

PAGE_BY_KEY = {p.key: p for p in PAGES}


class Pages:
    """Typed constants so routers write `Pages.CLIENTS`, not the string 'clients'."""

    DASHBOARD = "dashboard"
    PROJECTS = "projects"
    CLIENTS = "clients"
    PROCUREMENT = "procurement"
    MRP = "mrp"
    EMPLOYEES = "employees"
    USERS = "users"
    ROLES = "roles"


assert {v for k, v in vars(Pages).items() if k.isupper()} == set(PAGE_BY_KEY), "Pages and PAGES out of sync"
