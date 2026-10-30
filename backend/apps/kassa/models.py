"""Kassa va bank (add-kassa): cash desks and bank accounts, and the one document for every movement of
money — kirim / chiqim / transfer. Balances are never stored here: every posted order writes a journal
entry and the kassa balance is the ledger balance of the account (ADR 0007)."""

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel
from apps.projects.models import Currency

UZS = Currency.UZS
ZERO = Decimal("0")


def q2(value) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def fmt_money(value) -> str:
    """1250000.00 → '1 250 000', 1234.5 → '1 234,50' — the way error messages and chatter show so'm."""
    s = f"{q2(value):,.2f}".replace(",", " ").replace(".", ",")
    return s[:-3] if s.endswith(",00") else s


class AccountKind(models.TextChoices):
    CASH = "cash", "Kassa"
    BANK = "bank", "Bank"


class CashAccount(AuditModel):
    """One kassa or bank account. Its money lives on `account` in the ledger; one ledger account per
    kassa, so two desks never show the same balance."""

    TRACK = {
        "name": "Nomi", "kind": "Turi", "currency": "Valyuta", "account": "Hisob", "bank_name": "Bank",
        "mfo": "MFO", "account_number": "Hisob raqami", "responsible": "Mas'ul", "cash_limit": "Limit",
        "is_active": "Faol",
    }
    CHATTER_NAME = "Kassa"

    name = models.CharField("Nomi", max_length=120)
    kind = models.CharField(max_length=4, choices=AccountKind.choices, default=AccountKind.CASH)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=UZS)
    account = models.OneToOneField("accounting.Account", on_delete=models.PROTECT, related_name="cash_account")
    bank_name = models.CharField("Bank", max_length=150, blank=True, default="")
    mfo = models.CharField("MFO", max_length=10, blank=True, default="")
    account_number = models.CharField("Hisob raqami", max_length=40, blank=True, default="")
    responsible = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="cash_accounts")  # kassir
    cash_limit = models.DecimalField("Kassa limiti", max_digits=18, decimal_places=2, null=True, blank=True,
                                     validators=[MinValueValidator(ZERO)])
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-kind", "id"]  # cash desks first, then bank accounts
        verbose_name = "Kassa"
        verbose_name_plural = "Kassa va bank"

    def __str__(self):
        return self.name


class Direction(models.TextChoices):
    IN = "in", "Kirim"
    OUT = "out", "Chiqim"
    BOTH = "both", "Ikkalasi"


class Posting(models.TextChoices):
    PARTNER_CUSTOMER = "partner_customer", "Mijoz (4010 / 6310)"
    PARTNER_SUPPLIER = "partner_supplier", "Yetkazib beruvchi (6010 / 4310)"
    ACCOUNT = "account", "Hisob roli"


class PaymentPurpose(models.Model):
    """What a payment is for — and therefore how it posts (see design.md)."""

    name = models.CharField("Nomi", max_length=120, unique=True)
    direction = models.CharField(max_length=4, choices=Direction.choices, default=Direction.BOTH)
    posting = models.CharField(max_length=20, choices=Posting.choices, default=Posting.ACCOUNT)
    account_role = models.CharField("Hisob roli", max_length=40, blank=True, default="")  # posting=account
    requires_partner = models.BooleanField(default=False)
    requires_employee = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "To'lov maqsadi"
        verbose_name_plural = "To'lov maqsadlari"

    def __str__(self):
        return self.name


class OrderKind(models.TextChoices):
    IN = "in", "Kirim"
    OUT = "out", "Chiqim"
    TRANSFER = "transfer", "O'tkazma"


class OrderStatus(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    POSTED = "posted", "O'tkazilgan"
    CANCELLED = "cancelled", "Bekor qilingan"


S = OrderStatus
TRANSITIONS: dict[str, set[str]] = {
    S.DRAFT: {S.POSTED},
    S.POSTED: {S.CANCELLED},
    S.CANCELLED: set(),
}

# number prefix by (account kind, order kind); transfers have one sequence whatever the accounts are
PREFIXES = {
    (AccountKind.CASH, OrderKind.IN): "PKO",
    (AccountKind.CASH, OrderKind.OUT): "RKO",
    (AccountKind.BANK, OrderKind.IN): "BK",
    (AccountKind.BANK, OrderKind.OUT): "BT",
}
TRANSFER_PREFIX = "OT"


class CodeSequence(models.Model):
    """Per-prefix counter (PKO, RKO, BK, BT, OT): the forms and the cash book show gapless numbering per
    form, which the PK cannot give when five forms share one table."""

    prefix = models.CharField(max_length=4, primary_key=True)
    last = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.prefix} {self.last}"


class PaymentRequestStatus(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    SUBMITTED = "submitted", "Kutilmoqda"
    APPROVED = "approved", "Tasdiqlandi"
    REJECTED = "rejected", "Rad etildi"
    PAID = "paid", "To'langan"
    CANCELLED = "cancelled", "Bekor qilindi"


PRS = PaymentRequestStatus
# `paid` ↔ `approved` is derived from the posted chiqims linked to the request (services.sync_payment_request)
PAYMENT_REQUEST_TRANSITIONS: dict[str, set[str]] = {
    PRS.DRAFT: {PRS.SUBMITTED, PRS.CANCELLED},
    PRS.SUBMITTED: {PRS.APPROVED, PRS.REJECTED, PRS.CANCELLED},
    PRS.APPROVED: {PRS.PAID, PRS.CANCELLED},
    PRS.REJECTED: set(),
    PRS.PAID: {PRS.APPROVED},
    PRS.CANCELLED: set(),
}
PAYABLE = (PRS.APPROVED, PRS.PAID)


class PaymentRequest(AuditModel, SoftDeleteModel):
    """Pul so'rovi (ADR 0009): somebody asks kassa for money; kassa approves and pays it with chiqims.
    The asking document is known only generically (`source_model` + `source_id`)."""

    TRACK = {
        "status": "Holat", "partner": "Kontragent", "project": "Loyiha", "amount": "Summa",
        "currency": "Valyuta", "rate": "Kurs", "purpose": "Maqsad", "basis": "Asos", "needed_by": "Kerak sana",
        "notes": "Izoh",
    }
    CHATTER_NAME = "Pul so'rovi"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # PS-00001
    status = models.CharField(max_length=10, choices=PaymentRequestStatus.choices, default=PRS.DRAFT,
                              db_index=True)
    partner = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="payment_requests")
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="payment_requests")
    amount = models.DecimalField(max_digits=18, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, choices=Currency.choices, default=UZS)
    rate = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    purpose = models.ForeignKey(PaymentPurpose, null=True, blank=True, on_delete=models.PROTECT,
                                related_name="payment_requests")
    basis = models.CharField("Asos", max_length=300, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    needed_by = models.DateField("Kerak sana", null=True, blank=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name="+")
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_comment = models.TextField(blank=True, default="")
    source_model = models.CharField(max_length=60, blank=True, default="", db_index=True)  # procurement.purchaseorder
    source_id = models.PositiveIntegerField(null=True, blank=True)
    source_label = models.CharField(max_length=60, blank=True, default="")  # XB-00012

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Pul so'rovi"
        verbose_name_plural = "Pul so'rovlari"

    def __str__(self):
        return self.code or f"PS #{self.pk}"

    @property
    def allowed_statuses(self) -> list[str]:
        """Moves people make (paid ↔ approved is derived)."""
        moves = set(PAYMENT_REQUEST_TRANSITIONS[self.status])
        if self.status in PAYABLE:
            moves -= {PRS.PAID, PRS.APPROVED}
        return sorted(moves)


class CashOrder(AuditModel, SoftDeleteModel):
    """PKO / RKO / BK / BT / OT. Numbered when posted; posting writes one journal entry (`entry`);
    cancelling reverses it. A posted order is immutable."""

    TRACK = {
        "status": "Holat", "date": "Sana", "account": "Kassa / bank", "to_account": "Qayerga", "amount": "Summa",
        "rate": "Kurs", "purpose": "Maqsad", "account_role": "Hisob roli", "partner": "Kontragent",
        "project": "Loyiha", "employee": "Xodim", "invoice": "Hisob-faktura", "basis": "Asos",
        "received_from": "Kimdan", "issued_to": "Kimga", "notes": "Izoh",
    }
    CHATTER_NAME = "Kassa orderi"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)
    kind = models.CharField(max_length=8, choices=OrderKind.choices, db_index=True)
    status = models.CharField(max_length=10, choices=OrderStatus.choices, default=OrderStatus.DRAFT, db_index=True)
    date = models.DateField(db_index=True)
    account = models.ForeignKey(CashAccount, on_delete=models.PROTECT, related_name="orders")
    to_account = models.ForeignKey(CashAccount, null=True, blank=True, on_delete=models.PROTECT,
                                   related_name="incoming_transfers")
    amount = models.DecimalField(max_digits=18, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, choices=Currency.choices, default=UZS)  # = account.currency
    rate = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    purpose = models.ForeignKey(PaymentPurpose, null=True, blank=True, on_delete=models.PROTECT, related_name="orders")
    account_role = models.CharField(max_length=40, blank=True, default="")  # overrides purpose.account_role
    partner = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="cash_orders")
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="cash_orders")
    employee = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.PROTECT,
                                 related_name="cash_orders")
    invoice = models.ForeignKey("accounting.Invoice", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="cash_orders")
    basis = models.CharField("Asos", max_length=300, blank=True, default="")
    received_from = models.CharField("Kimdan qabul qilindi", max_length=200, blank=True, default="")
    issued_to = models.CharField("Kimga berildi", max_length=200, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    payment_request = models.ForeignKey(PaymentRequest, null=True, blank=True, on_delete=models.PROTECT,
                                        related_name="cash_orders")
    entry = models.ForeignKey("accounting.JournalEntry", null=True, blank=True, on_delete=models.SET_NULL,
                              related_name="+")
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="+")

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "Kassa orderi"
        verbose_name_plural = "Kassa orderlari"
        indexes = [
            models.Index(fields=["account", "date"], name="cashorder_account_date_idx"),
            models.Index(fields=["project", "status"], name="cashorder_project_status_idx"),
            models.Index(fields=["partner", "status"], name="cashorder_partner_status_idx"),
        ]

    def __str__(self):
        return self.code or f"Qoralama #{self.pk}"

    @property
    def prefix(self) -> str:
        if self.kind == OrderKind.TRANSFER:
            return TRANSFER_PREFIX
        return PREFIXES[(self.account.kind, self.kind)]

    @property
    def amount_uzs(self) -> Decimal:
        if self.currency == UZS or not self.rate:
            return self.amount
        return q2(self.amount * self.rate)

    @property
    def allowed_statuses(self) -> list[str]:
        return sorted(TRANSITIONS[self.status])
