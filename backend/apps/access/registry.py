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
    CRM = "crm"
    TELEPHONY = "telephony"
    TELEGRAM = "telegram"
    CLIENT_MAP = "client_map"
    PROCUREMENT = "procurement"  # purchase requests
    PURCHASE_APPROVE = "purchase_approve"
    PURCHASE_ORDERS = "purchase_orders"
    GOODS_RECEIPTS = "goods_receipts"
    SUPPLIERS = "suppliers"
    MRP = "mrp"
    EMPLOYEES = "employees"
    USERS = "users"
    ROLES = "roles"
    REFERENCES = "references"
    PRICING = "pricing"
    COMPANY = "company"
    ACCOUNTING = "accounting"
    ACCOUNTS = "accounts"
    INVOICES = "invoices"
    ACCOUNTING_REPORTS = "accounting_reports"


PAGES: tuple[PageDef, ...] = (
    PageDef(Pages.DASHBOARD, "Bosh sahifa", "Umumiy", VIEW_ONLY),
    PageDef(Pages.PROJECTS, "Loyihalar", "Savdo"),
    PageDef(Pages.CLIENTS, "Mijozlar", "Savdo"),
    PageDef(Pages.CRM, "Lidlar / voronka", "CRM"),
    PageDef(Pages.TELEPHONY, "Telefoniya", "CRM"),
    PageDef(Pages.TELEGRAM, "Telegram", "CRM"),
    PageDef(Pages.CLIENT_MAP, "Mijozlar xaritasi", "CRM", VIEW_ONLY),
    PageDef(Pages.PROCUREMENT, "Xarid so'rovlari", "Ta'minot"),
    PageDef(Pages.PURCHASE_APPROVE, "So'rovlarni tasdiqlash", "Ta'minot", (Action.VIEW, Action.UPDATE)),
    PageDef(Pages.PURCHASE_ORDERS, "Buyurtmalar", "Ta'minot"),
    PageDef(Pages.GOODS_RECEIPTS, "Kirim", "Ta'minot"),
    PageDef(Pages.SUPPLIERS, "Yetkazib beruvchilar", "Ta'minot"),
    PageDef(Pages.MRP, "MRP — material rejalash", "Ishlab chiqarish", planned=True),
    PageDef(Pages.ACCOUNTING, "Jurnal (o'tkazmalar)", "Buxgalteriya", (Action.VIEW, Action.CREATE, Action.UPDATE)),
    PageDef(Pages.INVOICES, "Hisob-fakturalar", "Buxgalteriya"),
    PageDef(Pages.ACCOUNTS, "Hisoblar rejasi, rollar, kurslar", "Buxgalteriya"),
    PageDef(Pages.ACCOUNTING_REPORTS, "Buxgalteriya hisobotlari", "Buxgalteriya", VIEW_ONLY),
    PageDef(Pages.EMPLOYEES, "Xodimlar", "Xodimlar"),
    PageDef(Pages.USERS, "Foydalanuvchilar", "Sozlamalar"),
    PageDef(Pages.ROLES, "Rollar va ruxsatlar", "Sozlamalar"),
    PageDef(Pages.REFERENCES, "Ma'lumotnomalar", "Sozlamalar"),
    PageDef(Pages.PRICING, "Narxlar", "Sozlamalar"),
    PageDef(Pages.COMPANY, "Kompaniya rekvizitlari", "Sozlamalar", (Action.VIEW, Action.UPDATE)),
)

PAGE_BY_KEY = {p.key: p for p in PAGES}

assert {v for k, v in vars(Pages).items() if k.isupper()} == set(PAGE_BY_KEY), "Pages and PAGES out of sync"
