"""One double-entry ledger (ADR 0007): accounts are data addressed by roles, entries are immutable,
balances are never stored. Invoices (hisob-faktura) are the documents this app posts itself."""

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q

from apps.core.models import AuditModel, SoftDeleteModel
from apps.projects.models import Currency  # UZS / USD — the same two the Loyiha uses

UZS = Currency.UZS
ZERO = Decimal("0")
CENT = Decimal("0.01")


def q2(value: Decimal) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


class AccountKind(models.TextChoices):
    ASSET = "asset", "Aktiv"
    CONTRA_ASSET = "contra_asset", "Kontr-aktiv"
    LIABILITY = "liability", "Majburiyat"
    EQUITY = "equity", "Kapital"
    INCOME = "income", "Daromad"
    EXPENSE = "expense", "Xarajat"


DEBIT_KINDS = {AccountKind.ASSET, AccountKind.EXPENSE}  # normal balance on the debit side


class Account(AuditModel):
    """One line of the chart of accounts (NSBU 21). Group accounts (0100, 1000…) have allow_posting=False."""

    TRACK = {"name": "Nomi", "kind": "Turi", "parent": "Guruh", "is_active": "Faol", "allow_posting": "O'tkazma"}
    CHATTER_NAME = "Hisob"

    code = models.CharField("Kod", max_length=4, unique=True,
                            validators=[RegexValidator(r"^\d{4}$", "Hisob kodi 4 ta raqam")])
    name = models.CharField("Nomi", max_length=200)
    kind = models.CharField(max_length=14, choices=AccountKind.choices)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="children")
    is_active = models.BooleanField(default=True)
    allow_posting = models.BooleanField("O'tkazma mumkin", default=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "Hisob"
        verbose_name_plural = "Hisoblar rejasi"

    def __str__(self):
        return f"{self.code} {self.name}"

    @property
    def debit_normal(self) -> bool:
        return self.kind in DEBIT_KINDS


class AccountRole(models.Model):
    """`ap_suppliers → 6010`: posting rules speak in keys, the accountant decides the account."""

    key = models.CharField(max_length=40, unique=True)
    label = models.CharField(max_length=120)
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="roles")

    class Meta:
        ordering = ["key"]
        verbose_name = "Hisob roli"
        verbose_name_plural = "Hisob rollari"

    def __str__(self):
        return f"{self.key} → {self.account.code}"


class SourceKind(models.TextChoices):
    DOCUMENT = "document", "Hujjat"
    MANUAL = "manual", "Qo'lda"
    REVERSAL = "reversal", "Storno"


class EntryStatus(models.TextChoices):
    POSTED = "posted", "O'tkazilgan"
    REVERSED = "reversed", "Storno qilingan"


class JournalEntry(AuditModel):
    """BX-00001. Written once by services.entry_post; the only later change is status → reversed."""

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)
    date = models.DateField(db_index=True)
    memo = models.CharField(max_length=300, blank=True, default="")
    # "procurement.goodsreceipt" + 42 — like chatter, so accounting never imports the apps that post to it
    source_model = models.CharField(max_length=60, blank=True, default="", db_index=True)
    source_id = models.PositiveBigIntegerField(null=True, blank=True)
    source_kind = models.CharField(max_length=10, choices=SourceKind.choices, default=SourceKind.DOCUMENT)
    status = models.CharField(max_length=10, choices=EntryStatus.choices, default=EntryStatus.POSTED, db_index=True)
    reversed_by = models.OneToOneField("self", null=True, blank=True, on_delete=models.PROTECT,
                                       related_name="reversal_of")
    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="+")
    posted_at = models.DateTimeField(auto_now_add=True)
    # Σ of the lines, kept on the header so the database itself refuses an unbalanced entry
    total_debit = models.DecimalField(max_digits=18, decimal_places=2, default=ZERO)
    total_credit = models.DecimalField(max_digits=18, decimal_places=2, default=ZERO)

    class Meta:
        ordering = ["-date", "-id"]
        constraints = [models.CheckConstraint(condition=Q(total_debit=F("total_credit")), name="entry_balanced")]
        indexes = [models.Index(fields=["source_model", "source_id"], name="entry_source_idx")]
        verbose_name = "Jurnal o'tkazmasi"
        verbose_name_plural = "Jurnal"

    def __str__(self):
        return f"{self.code} {self.memo}"[:60]


class JournalLine(models.Model):
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    date = models.DateField()  # copy of entry.date: reports filter lines by date without a join
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="lines")
    debit = models.DecimalField(max_digits=18, decimal_places=2, default=ZERO)
    credit = models.DecimalField(max_digits=18, decimal_places=2, default=ZERO)
    partner = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="journal_lines")
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="journal_lines")
    currency = models.CharField(max_length=3, choices=Currency.choices, default=UZS)
    amount_cur = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)  # in `currency`
    rate = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    memo = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        ordering = ["entry_id", "id"]
        constraints = [
            models.CheckConstraint(condition=(Q(debit__gt=0, credit=0) | Q(credit__gt=0, debit=0)),
                                   name="line_one_side"),
        ]
        indexes = [
            models.Index(fields=["account", "date"], name="line_account_date_idx"),
            models.Index(fields=["partner", "account"], name="line_partner_account_idx"),
            models.Index(fields=["project", "account"], name="line_project_account_idx"),
        ]

    def __str__(self):
        side = f"Dt {self.debit}" if self.debit else f"Kt {self.credit}"
        return f"{self.account.code} {side}"

    @property
    def signed(self) -> Decimal:
        return self.debit - self.credit


class ExchangeRate(models.Model):
    """Central Bank rate for one day: so'm per unit of `currency`."""

    date = models.DateField()
    currency = models.CharField(max_length=3, choices=Currency.choices)
    rate = models.DecimalField(max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0.0001"))])
    source = models.CharField(max_length=10, default="manual")  # manual | cbu
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "currency"]
        constraints = [models.UniqueConstraint(fields=["date", "currency"], name="uq_rate_date_currency")]
        verbose_name = "Valyuta kursi"
        verbose_name_plural = "Valyuta kurslari"

    def __str__(self):
        return f"{self.currency} {self.date} {self.rate}"


class InvoiceKind(models.TextChoices):
    CUSTOMER = "customer", "Mijozga"
    SUPPLIER = "supplier", "Yetkazib beruvchidan"


class InvoiceStatus(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    CONFIRMED = "confirmed", "Tasdiqlangan"
    CANCELLED = "cancelled", "Bekor qilingan"


class Invoice(AuditModel, SoftDeleteModel):
    """HF-00001 — the ESF as Rombo's books see it. Confirming posts the entry; cancelling reverses it."""

    TRACK = {
        "status": "Holat", "kind": "Turi", "partner": "Kontragent", "project": "Loyiha", "date": "Sana",
        "external_number": "ESF №", "external_date": "ESF sanasi", "currency": "Valyuta", "rate": "Kurs",
        "gross": "Jami", "notes": "Izoh",
    }
    CHATTER_NAME = "Hisob-faktura"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)
    kind = models.CharField(max_length=10, choices=InvoiceKind.choices, db_index=True)
    partner = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="invoices")
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="invoices")
    date = models.DateField(db_index=True)
    external_number = models.CharField("ESF №", max_length=50, blank=True, default="")
    external_date = models.DateField("ESF sanasi", null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=UZS)
    rate = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    status = models.CharField(max_length=10, choices=InvoiceStatus.choices, default=InvoiceStatus.DRAFT,
                              db_index=True)
    entry = models.ForeignKey(JournalEntry, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    notes = models.TextField(blank=True, default="")
    # document totals in document currency (not balances: the ledger has those)
    net = models.DecimalField(max_digits=18, decimal_places=2, default=ZERO)
    vat = models.DecimalField(max_digits=18, decimal_places=2, default=ZERO)
    gross = models.DecimalField(max_digits=18, decimal_places=2, default=ZERO)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "Hisob-faktura"
        verbose_name_plural = "Hisob-fakturalar"

    def __str__(self):
        return f"{self.code} {self.partner}"

    def recalc(self) -> None:
        lines = list(self.lines.all())
        self.net = sum((ln.net for ln in lines), ZERO)
        self.vat = sum((ln.vat for ln in lines), ZERO)
        self.gross = self.net + self.vat


class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    sort_order = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=300)
    unit = models.CharField(max_length=20, blank=True, default="dona")
    qty = models.DecimalField(max_digits=14, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))])
    price = models.DecimalField(max_digits=18, decimal_places=2, validators=[MinValueValidator(ZERO)])
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=ZERO)
    role = models.CharField(max_length=40, blank=True, default="")  # supplier lines: which expense / asset

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.name

    @property
    def net(self) -> Decimal:
        return q2(self.qty * self.price)

    @property
    def vat(self) -> Decimal:
        return q2(self.net * self.vat_rate / 100)

    @property
    def gross(self) -> Decimal:
        return self.net + self.vat
