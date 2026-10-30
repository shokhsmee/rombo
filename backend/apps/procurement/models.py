"""Xaridlar: purchase request (XS) → purchase order (XB) → goods receipt (KR).

Every document hangs off a Loyiha (ADR 0004) through its lines; the receipt posts to the ledger
(ADR 0007); the supplier is a client of kind `supplier` (ADR 0008).
"""

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel

ZERO = Decimal("0")
CENT = Decimal("0.01")


def money(v: Decimal) -> Decimal:
    return v.quantize(CENT, rounding=ROUND_HALF_UP)


class Currency(models.TextChoices):
    UZS = "UZS", "so'm"
    USD = "USD", "USD"


# ------------------------------------------------------------------ approval steps


class ApprovalStep(AuditModel):
    """One level of request approval (add-purchase-approvals-and-money-requests). Any active member of
    `role` (or a superuser) decides it; steps run in `sequence` order. No active step → single level."""

    TRACK = {"sequence": "Tartib", "name": "Nomi", "role": "Rol", "is_active": "Faol"}
    CHATTER_NAME = "Tasdiqlash bosqichi"

    sequence = models.PositiveSmallIntegerField("Tartib", default=10, db_index=True)
    name = models.CharField("Nomi", max_length=100)
    role = models.ForeignKey("access.Role", on_delete=models.PROTECT, related_name="approval_steps")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sequence", "id"]
        verbose_name = "Tasdiqlash bosqichi"
        verbose_name_plural = "Tasdiqlash bosqichlari"

    def __str__(self):
        return self.name


class Decision(models.TextChoices):
    APPROVED = "approved", "Tasdiqlandi"
    REJECTED = "rejected", "Rad etildi"


# ------------------------------------------------------------------ purchase request


class RequestStatus(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    SUBMITTED = "submitted", "Tasdiqlashga yuborilgan"
    APPROVED = "approved", "Tasdiqlangan"
    REJECTED = "rejected", "Rad etilgan"
    ORDERED = "ordered", "Buyurtma qilingan"
    CANCELLED = "cancelled", "Bekor qilindi"


RS = RequestStatus

# Moves made by people. `ordered` is derived from the lines (services._derive_request_status).
REQUEST_TRANSITIONS: dict[str, set[str]] = {
    RS.DRAFT: {RS.SUBMITTED, RS.CANCELLED},
    RS.SUBMITTED: {RS.APPROVED, RS.REJECTED, RS.DRAFT},
    RS.APPROVED: {RS.ORDERED, RS.CANCELLED},
    RS.REJECTED: {RS.DRAFT},
    RS.ORDERED: set(),
    RS.CANCELLED: set(),
}


class PurchaseRequest(AuditModel, SoftDeleteModel):
    TRACK = {
        "status": "Holat", "project": "Loyiha", "requester": "So'rovchi", "needed_by": "Kerak sana",
        "notes": "Izoh",
    }
    CHATTER_NAME = "Xarid so'rovi"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # XS-00001
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.DRAFT,
                              db_index=True)
    project = models.ForeignKey("projects.Project", on_delete=models.PROTECT,
                                related_name="purchase_requests")
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="+")
    needed_by = models.DateField("Kerak sana", null=True, blank=True, db_index=True)
    notes = models.TextField(blank=True, default="")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL,
                                    related_name="+")
    # the step a submitted request waits at (multi-level approval); null otherwise
    approval_step = models.ForeignKey(ApprovalStep, null=True, blank=True, on_delete=models.SET_NULL,
                                      related_name="waiting_requests")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Xarid so'rovi"
        verbose_name_plural = "Xarid so'rovlari"

    def __str__(self):
        return self.code or f"XS #{self.pk}"

    @property
    def allowed_statuses(self) -> list[str]:
        return sorted(REQUEST_TRANSITIONS[self.status] - {RS.ORDERED})


class RequestApproval(models.Model):
    """One decision on a request: which step, who, approved / rejected, why, when."""

    request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name="approvals")
    step = models.ForeignKey(ApprovalStep, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    step_name = models.CharField(max_length=100, blank=True, default="")  # kept when the step is deleted
    decision = models.CharField(max_length=10, choices=Decision.choices)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="+")
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.step_name or '—'}: {self.decision}"


class PurchaseRequestLine(models.Model):
    request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey("pricing.PriceListItem", null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="+")  # price-list item; null for free text
    sort_order = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=200)
    unit = models.CharField(max_length=20)
    qty = models.DecimalField(max_digits=12, decimal_places=2,
                              validators=[MinValueValidator(Decimal("0.01"))])
    note = models.CharField(max_length=200, blank=True, default="")
    ordered_qty = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO)  # kept by order services

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.name} {self.qty.normalize():f} {self.unit}"

    @property
    def remaining_qty(self) -> Decimal:
        return max(self.qty - self.ordered_qty, ZERO)


# ------------------------------------------------------------------ purchase order


class OrderStatus(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    SENT = "sent", "Yuborilgan"
    PARTIALLY_RECEIVED = "partially_received", "Qisman kelgan"
    RECEIVED = "received", "Kelgan"
    CANCELLED = "cancelled", "Bekor qilindi"


OS = OrderStatus

# Moves made by people; `partially_received` / `received` are derived from the receipts.
ORDER_TRANSITIONS: dict[str, set[str]] = {
    OS.DRAFT: {OS.SENT, OS.CANCELLED},
    OS.SENT: {OS.PARTIALLY_RECEIVED, OS.RECEIVED, OS.CANCELLED},
    OS.PARTIALLY_RECEIVED: {OS.RECEIVED},
    OS.RECEIVED: set(),
    OS.CANCELLED: set(),
}
RECEIVING_STATUSES = {OS.SENT, OS.PARTIALLY_RECEIVED, OS.RECEIVED}


class SentVia(models.TextChoices):
    PRINT = "print", "Chop etib"
    EMAIL = "email", "Email"
    OTHER = "other", "Boshqa"


class PurchaseOrder(AuditModel, SoftDeleteModel):
    TRACK = {
        "status": "Holat", "supplier": "Yetkazib beruvchi", "project": "Loyiha", "date": "Sana",
        "expected_date": "Kutilayotgan sana", "currency": "Valyuta", "rate": "Kurs", "notes": "Izoh",
    }
    CHATTER_NAME = "Buyurtma"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # XB-00001
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.DRAFT,
                              db_index=True)
    supplier = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="purchase_orders")
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="purchase_orders")  # optional: one AKFA order can serve several
    date = models.DateField(db_index=True)
    expected_date = models.DateField("Kutilayotgan sana", null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.UZS)
    rate = models.DecimalField("Kurs", max_digits=12, decimal_places=2, null=True, blank=True,
                               validators=[MinValueValidator(Decimal("0.01"))])  # UZS per unit of currency
    notes = models.TextField(blank=True, default="")

    sent_at = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="+")
    sent_via = models.CharField(max_length=10, choices=SentVia.choices, blank=True, default="")
    sent_to = models.CharField(max_length=200, blank=True, default="")
    # kassa money request (ADR 0009): the order is sent only when it is approved or paid
    payment_request = models.ForeignKey("kassa.PaymentRequest", null=True, blank=True,
                                        on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Buyurtma"
        verbose_name_plural = "Buyurtmalar"

    def __str__(self):
        return self.code or f"XB #{self.pk}"

    @property
    def allowed_statuses(self) -> list[str]:
        return sorted(ORDER_TRANSITIONS[self.status] - {OS.PARTIALLY_RECEIVED, OS.RECEIVED})

    @property
    def uzs_rate(self) -> Decimal:
        return Decimal("1") if self.currency == Currency.UZS else (self.rate or ZERO)

    def totals(self) -> dict[str, Decimal]:
        """net / vat / gross in the order currency and in UZS (through the header rate)."""
        lines = list(self.lines.all())
        net = sum((ln.net for ln in lines), ZERO)
        vat = sum((ln.vat for ln in lines), ZERO)
        gross = net + vat
        r = self.uzs_rate
        return {"net": net, "vat": vat, "gross": gross,
                "net_uzs": money(net * r), "vat_uzs": money(vat * r), "gross_uzs": money(gross * r)}


class PurchaseOrderLine(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    request_line = models.ForeignKey(PurchaseRequestLine, null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name="order_lines")
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="purchase_order_lines")  # inherited from the request line
    item = models.ForeignKey("pricing.PriceListItem", null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="+")
    sort_order = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=200)
    unit = models.CharField(max_length=20)
    qty = models.DecimalField(max_digits=12, decimal_places=2,
                              validators=[MinValueValidator(Decimal("0.01"))])
    price = models.DecimalField(max_digits=14, decimal_places=2, default=ZERO,
                                validators=[MinValueValidator(ZERO)])
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=ZERO)  # percent: 12.00
    received_qty = models.DecimalField(max_digits=12, decimal_places=2,
                                       default=ZERO)  # kept by receipt services

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.name} {self.qty.normalize():f} {self.unit}"

    @property
    def net(self) -> Decimal:
        return money(self.qty * self.price)

    @property
    def vat(self) -> Decimal:
        return money(self.net * self.vat_rate / 100)

    @property
    def gross(self) -> Decimal:
        return self.net + self.vat

    @property
    def remaining_qty(self) -> Decimal:
        return max(self.qty - self.received_qty, ZERO)


# ------------------------------------------------------------------ goods receipt


class ReceiptStatus(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    POSTED = "posted", "O'tkazilgan"
    CANCELLED = "cancelled", "Bekor qilindi"


RCS = ReceiptStatus

RECEIPT_TRANSITIONS: dict[str, set[str]] = {
    RCS.DRAFT: {RCS.POSTED},
    RCS.POSTED: {RCS.CANCELLED},
    RCS.CANCELLED: set(),
}


class GoodsReceipt(AuditModel, SoftDeleteModel):
    TRACK = {
        "status": "Holat", "order": "Buyurtma", "supplier": "Yetkazib beruvchi", "date": "Sana",
        "storekeeper": "Omborchi", "warehouse": "Ombor", "invoice_number": "Hisob-faktura №",
        "invoice_date": "Hisob-faktura sanasi",
        "invoice_total": "Hisob-faktura summasi", "notes": "Izoh",
    }
    CHATTER_NAME = "Kirim"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # KR-00001
    status = models.CharField(max_length=20, choices=ReceiptStatus.choices, default=ReceiptStatus.DRAFT,
                              db_index=True)
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="receipts")
    supplier = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="goods_receipts")
    date = models.DateField(db_index=True)
    storekeeper = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL,
                                    related_name="+")
    # where the goods go (add-inventory); empty = the default warehouse when posted
    warehouse = models.ForeignKey("inventory.Warehouse", null=True, blank=True, on_delete=models.PROTECT,
                                  related_name="goods_receipts")
    # the supplier's ESF for the goods: typed by the accountant, no separate invoice document (design.md)
    invoice_number = models.CharField("Hisob-faktura №", max_length=50, blank=True, default="")
    invoice_date = models.DateField(null=True, blank=True)
    invoice_total = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True,
                                        validators=[MinValueValidator(ZERO)])
    notes = models.TextField(blank=True, default="")

    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="+")
    # the ledger entry this receipt posted (ADR 0007); cancelling reverses it
    entry = models.ForeignKey("accounting.JournalEntry", null=True, blank=True, on_delete=models.PROTECT,
                              related_name="+", editable=False)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Kirim"
        verbose_name_plural = "Kirimlar"

    def __str__(self):
        return self.code or f"KR #{self.pk}"

    @property
    def allowed_statuses(self) -> list[str]:
        return sorted(RECEIPT_TRANSITIONS[self.status])

    def totals(self) -> dict[str, Decimal]:
        lines = list(self.lines.all())
        net = sum((ln.net for ln in lines), ZERO)
        vat = sum((ln.vat for ln in lines), ZERO)
        gross = net + vat
        r = self.order.uzs_rate
        return {"net": net, "vat": vat, "gross": gross,
                "net_uzs": money(net * r), "vat_uzs": money(vat * r), "gross_uzs": money(gross * r)}


class GoodsReceiptLine(models.Model):
    receipt = models.ForeignKey(GoodsReceipt, on_delete=models.CASCADE, related_name="lines")
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, related_name="receipt_lines")
    qty = models.DecimalField(max_digits=12, decimal_places=2,
                              validators=[MinValueValidator(Decimal("0.01"))])
    price = models.DecimalField(max_digits=14, decimal_places=2, default=ZERO)  # copied from the order line
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=ZERO)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.order_line.name} {self.qty.normalize():f}"

    @property
    def net(self) -> Decimal:
        return money(self.qty * self.price)

    @property
    def vat(self) -> Decimal:
        return money(self.net * self.vat_rate / 100)

    @property
    def gross(self) -> Decimal:
        return self.net + self.vat
