"""Seeded purposes (design.md table) and the two default accounts. Shared by the command and the tests."""

from apps.accounting.models import AccountRole
from apps.accounting.seed import seed_chart
from apps.accounting.selectors import role_account
from apps.kassa.models import AccountKind, CashAccount, Direction, PaymentPurpose, Posting

# name, direction, posting, account_role, requires_partner, requires_employee
PURPOSES = (
    ("Mijozdan to'lov", Direction.IN, Posting.PARTNER_CUSTOMER, "", True, False),
    ("Mijozga qaytarish", Direction.OUT, Posting.PARTNER_CUSTOMER, "", True, False),
    ("Yetkazib beruvchiga to'lov", Direction.OUT, Posting.PARTNER_SUPPLIER, "", True, False),
    ("Yetkazib beruvchidan qaytarish", Direction.IN, Posting.PARTNER_SUPPLIER, "", True, False),
    ("Xarajat", Direction.OUT, Posting.ACCOUNT, "admin_expense", False, False),
    ("Ish haqi", Direction.OUT, Posting.ACCOUNT, "payroll", False, True),
    ("Xodimga avans", Direction.OUT, Posting.ACCOUNT, "employee_advance", False, True),
    ("Avans qaytarildi", Direction.IN, Posting.ACCOUNT, "employee_advance", False, True),
    ("Ta'sischidan qarz", Direction.IN, Posting.ACCOUNT, "founder_loan", False, False),
    ("Ta'sischiga qaytarish", Direction.OUT, Posting.ACCOUNT, "founder_loan", False, False),
    ("Bank xizmati", Direction.OUT, Posting.ACCOUNT, "other_op_expense", False, False),
    ("Soliq to'lovi", Direction.OUT, Posting.ACCOUNT, "taxes_payable", False, False),
    ("Boshqa kirim", Direction.IN, Posting.ACCOUNT, "other_op_income", False, False),
    ("Boshqa chiqim", Direction.OUT, Posting.ACCOUNT, "other_op_expense", False, False),
)

DEFAULT_ACCOUNTS = (
    ("Asosiy kassa", AccountKind.CASH, "UZS"),
    ("Hisob raqami", AccountKind.BANK, "UZS"),
)


def default_role(kind: str, currency: str) -> str:
    return f"{kind}_{currency.lower()}"  # cash_uzs, cash_usd, bank_uzs, bank_usd


def seed_kassa() -> tuple[int, int]:
    """Purposes are upserted by name (posting rules refresh, the accountant's extra purposes stay); the two
    default accounts are created only when there is no account at all. Needs the chart: seeds it if absent."""
    if not AccountRole.objects.filter(key="cash_uzs").exists():
        seed_chart()
    n_purposes = 0
    for i, (name, direction, posting, role, partner, employee) in enumerate(PURPOSES):
        _, created = PaymentPurpose.objects.update_or_create(
            name=name,
            defaults={"direction": direction, "posting": posting, "account_role": role,
                      "requires_partner": partner, "requires_employee": employee, "sort_order": (i + 1) * 10})
        n_purposes += created
    n_accounts = 0
    if not CashAccount.objects.exists():
        for name, kind, currency in DEFAULT_ACCOUNTS:
            CashAccount.objects.create(name=name, kind=kind, currency=currency,
                                       account=role_account(default_role(kind, currency)))
            n_accounts += 1
    return n_purposes, n_accounts
