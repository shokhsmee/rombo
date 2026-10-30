"""Ombor (add-inventory, ADR 0010): warehouses, products and the one table of stock moves.

Every movement of stock is one `StockMove` row (one product, one movement). Stock on hand and its value
are sums over posted rows (selectors.stock); nothing here stores a balance. Moves that change an account
post through the ledger (ADR 0007); a receipt row reuses its goods receipt's entry.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel

ZERO = Decimal("0")
CENT = Decimal("0.01")
QTY = Decimal("0.001")


def q2(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def q3(value) -> Decimal:
    return Decimal(value).quantize(QTY, rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------ warehouse


class Warehouse(AuditModel):
    TRACK = {
        "name": "Nomi",
        "address": "Manzil",
        "responsible": "Mas'ul",
        "is_default": "Asosiy",
        "is_active": "Faol",
    }
    CHATTER_NAME = "Ombor"

    name = models.CharField("Nomi", max_length=120, unique=True)
    address = models.CharField("Manzil", max_length=250, blank=True, default="")
    responsible = models.ForeignKey(
        "employees.Employee", null=True, blank=True, on_delete=models.SET_NULL, related_name="warehouses"
    )  # omborchi
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_default", "name"]
        verbose_name = "Ombor"
        verbose_name_plural = "Omborlar"

    def __str__(self):
        return self.name


# ------------------------------------------------------------------ product


class Category(models.TextChoices):
    PROFIL = "profil", "Profil"
    OYNA = "oyna", "Oyna"
    FURNITURA = "furnitura", "Furnitura"
    MATERIAL = "material", "Boshqa material"
    TAYYOR = "tayyor", "Tayyor mahsulot"


class Product(AuditModel, SoftDeleteModel):
    TRACK = {
        "name": "Nomi",
        "sku": "Artikul",
        "unit": "Birlik",
        "category": "Turkum",
        "default_cost": "Tannarx",
        "is_active": "Faol",
        "notes": "Izoh",
    }
    CHATTER_NAME = "Mahsulot"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # MH-00001
    name = models.CharField("Nomi", max_length=200)
    sku = models.CharField("Artikul", max_length=60, blank=True, default="", db_index=True)
    unit = models.CharField("O'lchov birligi", max_length=20, default="dona")
    category = models.CharField(
        max_length=12, choices=Category.choices, default=Category.MATERIAL, db_index=True
    )
    default_cost = models.DecimalField("Tannarx", max_digits=18, decimal_places=2, default=ZERO)
    # the price-list item a goods receipt line points to; lets the receipt find its product
    price_item = models.ForeignKey(
        "pricing.PriceListItem", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "Mahsulot"
        verbose_name_plural = "Mahsulotlar"

    def __str__(self):
        return self.name

    @property
    def stock_role(self) -> str:
        """The ledger role whose balance is this product's value (design.md)."""
        return "finished_goods" if self.category == Category.TAYYOR else "materials"


# ------------------------------------------------------------------ stock move


class MoveType(models.TextChoices):
    RECEIPT = "receipt", "Kirim"
    ISSUE = "issue", "Chiqim"
    OUTPUT = "output", "Ishlab chiqarish"
    DELIVERY = "delivery", "Yetkazish"
    TRANSFER = "transfer", "Ko'chirish"
    ADJUST = "adjust", "Tuzatish"


T = MoveType
INCOMING = (T.RECEIPT, T.OUTPUT)  # + qty in `warehouse`
OUTGOING = (T.ISSUE, T.DELIVERY)  # − qty in `warehouse`
NEEDS_PROJECT = (T.ISSUE, T.OUTPUT, T.DELIVERY)
MANUAL_TYPES = (T.ISSUE, T.OUTPUT, T.DELIVERY, T.TRANSFER, T.ADJUST)  # typed by people; receipts come from KR


class MoveStatus(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    POSTED = "posted", "O'tkazilgan"
    CANCELLED = "cancelled", "Bekor qilingan"


S = MoveStatus
TRANSITIONS: dict[str, set[str]] = {
    S.DRAFT: {S.POSTED},
    S.POSTED: {S.CANCELLED},
    S.CANCELLED: set(),
}


class StockMove(AuditModel, SoftDeleteModel):
    """One product moved once. `qty` / `amount` are positive except for `adjust`, where they carry the sign
    (negative = shortage). `unit_cost` / `amount` are in UZS."""

    TRACK = {
        "status": "Holat",
        "type": "Turi",
        "date": "Sana",
        "product": "Mahsulot",
        "warehouse": "Ombor",
        "to_warehouse": "Qayerga",
        "qty": "Miqdor",
        "unit_cost": "Tannarx",
        "project": "Loyiha",
        "partner": "Kontragent",
        "notes": "Izoh",
    }
    CHATTER_NAME = "Ombor harakati"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # OM-00001
    type = models.CharField(max_length=10, choices=MoveType.choices, db_index=True)
    status = models.CharField(max_length=10, choices=MoveStatus.choices, default=S.DRAFT, db_index=True)
    date = models.DateField(db_index=True)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="moves")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="moves")
    to_warehouse = models.ForeignKey(
        Warehouse, null=True, blank=True, on_delete=models.PROTECT, related_name="incoming_moves"
    )
    qty = models.DecimalField(max_digits=14, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)  # set when posted
    amount = models.DecimalField(max_digits=18, decimal_places=2, default=ZERO)
    project = models.ForeignKey(
        "projects.Project", null=True, blank=True, on_delete=models.PROTECT, related_name="stock_moves"
    )
    partner = models.ForeignKey(
        "clients.Client", null=True, blank=True, on_delete=models.PROTECT, related_name="stock_moves"
    )
    # the document this row came from (procurement.goodsreceipt for kirim), referenced generically
    source_model = models.CharField(max_length=60, blank=True, default="", db_index=True)
    source_id = models.PositiveIntegerField(null=True, blank=True)
    source_label = models.CharField(max_length=60, blank=True, default="")
    entry = models.ForeignKey(
        "accounting.JournalEntry", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )  # the move's own entry; receipt rows have none
    notes = models.TextField(blank=True, default="")
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "Ombor harakati"
        verbose_name_plural = "Ombor harakatlari"
        indexes = [
            models.Index(fields=["product", "status"], name="stockmove_product_status_idx"),
            models.Index(fields=["warehouse", "status"], name="stockmove_wh_status_idx"),
            models.Index(fields=["project", "status"], name="stockmove_project_status_idx"),
            models.Index(fields=["source_model", "source_id"], name="stockmove_source_idx"),
        ]

    def __str__(self):
        return self.code or f"OM #{self.pk}"

    @property
    def allowed_statuses(self) -> list[str]:
        return sorted(TRANSITIONS[self.status])
