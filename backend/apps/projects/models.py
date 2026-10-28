from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel


class ProjectStatus(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    CONFIRMED = "confirmed", "Tasdiqlangan"
    PROCUREMENT = "procurement", "Xaridda"
    PRODUCTION = "production", "Ishlab chiqarishda"
    READY = "ready", "Tayyor"
    DELIVERED = "delivered", "Yetkazildi"
    CLOSED = "closed", "Yopildi"
    CANCELLED = "cancelled", "Bekor qilindi"


S = ProjectStatus

# Allowed moves. Anything else is rejected by services.project_change_status.
TRANSITIONS: dict[str, set[str]] = {
    S.DRAFT: {S.CONFIRMED, S.CANCELLED},
    S.CONFIRMED: {S.PROCUREMENT, S.PRODUCTION, S.DRAFT, S.CANCELLED},
    S.PROCUREMENT: {S.PRODUCTION, S.CANCELLED},
    S.PRODUCTION: {S.READY},
    S.READY: {S.DELIVERED},
    S.DELIVERED: {S.CLOSED},
    S.CLOSED: set(),
    S.CANCELLED: {S.DRAFT},
}

# From procurement on, the fields production depends on are locked (MRP plans are computed from them).
# Money, contacts, dates and notes stay editable: advances and debt change while the order is in the factory.
EDITABLE_STATUSES = {S.DRAFT, S.CONFIRMED}
PRODUCTION_FIELDS = {"name", "client", "items", "brand", "product_name", "mosquito_net", "dismantling"}
FINISHED_STATUSES = {S.DELIVERED, S.CLOSED, S.CANCELLED}


class Currency(models.TextChoices):
    UZS = "UZS", "so'm"
    USD = "USD", "USD"


class Project(AuditModel, SoftDeleteModel):
    TRACK = {
        "status": "Holat", "name": "Nomi", "client": "Mijoz", "manager": "Menejer", "deadline": "Muddat",
        "amount": "Summa", "currency": "Valyuta", "contract_number": "Shartnoma №",
        "contract_date": "Shartnoma sanasi", "object_address": "Obyekt manzili", "region": "Hudud",
        "sale_date": "Sotuv sanasi", "service_amount": "Xizmat summasi", "advance_amount": "Avans",
        "phone": "Telefon", "partner": "Hamkor", "sales_channel": "Sotuv kanali", "brand": "Brend",
        "product_name": "Mahsulot", "location": "Lokatsiya", "mosquito_net": "Maskitka",
        "dismantling": "Demontaj",
    }
    CHATTER_NAME = "Loyiha"

    code = models.CharField(max_length=24, unique=True, null=True, editable=False)  # LY-26-00001
    name = models.CharField("Nomi", max_length=255)
    status = models.CharField(max_length=20, choices=ProjectStatus.choices, default=ProjectStatus.DRAFT,
                              db_index=True)

    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="projects")
    manager = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="projects")  # "Sotuvchi" on the card
    partner = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="partner_projects")  # a dealer / partner who brought the order
    sales_channel = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.PROTECT,
                                      related_name="+", limit_choices_to={"kind": "sales_channel"})
    brand = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.PROTECT,
                              related_name="+", limit_choices_to={"kind": "brand"})
    product_name = models.CharField("Mahsulot", max_length=200, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="")
    location = models.CharField("Lokatsiya", max_length=500, blank=True, default="")  # map link or "41.31, 69.27"
    mosquito_net = models.BooleanField("Maskitka", default=False)
    dismantling = models.BooleanField("Demontaj", default=False)
    sale_date = models.DateField(null=True, blank=True, db_index=True)

    object_address = models.CharField("Obyekt manzili", max_length=255, blank=True, default="")
    region = models.CharField(max_length=100, blank=True, default="")
    contract_number = models.CharField(max_length=50, blank=True, default="")
    contract_date = models.DateField(null=True, blank=True)
    deadline = models.DateField(null=True, blank=True, db_index=True)
    amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"),
                                 validators=[MinValueValidator(Decimal("0"))])  # order sum (products)
    service_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"),
                                         validators=[MinValueValidator(Decimal("0"))])  # installation etc.
    advance_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"),
                                         validators=[MinValueValidator(Decimal("0"))])
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.UZS)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Loyiha"
        verbose_name_plural = "Loyihalar"

    def __str__(self):
        return f"{self.code} {self.name}"

    @property
    def allowed_statuses(self) -> list[str]:
        return sorted(TRANSITIONS[self.status])

    @property
    def total_amount(self) -> Decimal:
        return self.amount + self.service_amount

    @property
    def debt_amount(self) -> Decimal:
        """Computed, never stored: it can't drift from the amounts it comes from."""
        return self.amount + self.service_amount - self.advance_amount


class ProjectItem(models.Model):
    """One line of the order: a product type with its area and count (Termo 12.5 m² × 4).
    MRP will explode these lines into materials."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="items")
    product_type = models.ForeignKey("references.RefItem", on_delete=models.PROTECT, related_name="+",
                                     limit_choices_to={"kind": "product_type"})
    area_m2 = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_type} {self.area_m2} m² × {self.quantity}"


def drawing_path(instance, filename: str) -> str:
    from django.utils import timezone

    return f"projects/{timezone.localdate():%Y/%m}/{instance.project_id}/{filename}"


class ProjectFile(models.Model):
    """A drawing (chizma) or other document of the order. Downloaded only through the API."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="files")
    file = models.FileField(upload_to=drawing_path, max_length=300)
    name = models.CharField(max_length=200)
    size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
