from decimal import ROUND_HALF_UP, Decimal

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
PRODUCTION_FIELDS = {
    "name", "client", "items", "brand", "product_name", "mosquito_net", "dismantling",
    "profile_color", "door_accessory", "window_accessory", "windowsill", "glass", "shotlandka",
}
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
        "dismantling": "Demontaj", "advance_date": "Avans sanasi", "usd_rate": "USD kursi",
        "profile_color": "Profil rangi", "door_accessory": "Eshik aksessuari", "window_accessory": "Rom aksessuari",
        "windowsill": "Podokonnik", "glass": "Oyna", "shotlandka": "Shotlandka",
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
    advance_date = models.DateField("Avans olingan sana", null=True, blank=True)
    # USD → so'm rate on the day of the offer: hisob-kitob is priced in USD, the contract shows both
    usd_rate = models.DecimalField("USD kursi", max_digits=12, decimal_places=2, null=True, blank=True,
                                   validators=[MinValueValidator(Decimal("1"))])

    # Product spec block of the contract ("Маҳсулотларни ишлаб чиқариш учун талабнома")
    profile_color = models.CharField("Profil rangi", max_length=200, blank=True, default="")
    door_accessory = models.CharField("Eshik aksessuari", max_length=200, blank=True, default="")
    window_accessory = models.CharField("Rom aksessuari", max_length=200, blank=True, default="")
    windowsill = models.CharField("Podokonnik (rangi, o'lchami)", max_length=200, blank=True, default="")
    glass = models.CharField("Oyna turi va rangi", max_length=200, blank=True, default="")
    shotlandka = models.CharField("Shotlandka", max_length=200, blank=True, default="")

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


def round_sum(qty: Decimal, price: Decimal) -> Decimal:
    """Line sum exactly as on the paper hisob-kitob: half-up to whole units (2.5 x 80.2 = 200.5 -> 201)."""
    return (qty * price).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


class ProjectCalc(AuditModel):
    """Hisob-kitob varaqasi (invoice/calculation) of a Loyiha, made from one price list.

    Lines copy name/unit/price when the calc is created, so later price-list changes never re-price
    an offer already given to the client. The lines are also the order's material list (Zakup, MRP).
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="calcs")
    price_list = models.ForeignKey("pricing.PriceList", null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="calcs")
    title = models.CharField(max_length=150)  # price list name at creation, e.g. "Rombo Termo 306J 65 seriya"
    bar_length_m = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.USD)
    calc_date = models.DateField()
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.title

    @property
    def total(self) -> Decimal:
        return sum((ln.line_sum for ln in self.lines.all()), Decimal("0"))


class ProjectCalcLine(models.Model):
    calc = models.ForeignKey(ProjectCalc, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey("pricing.PriceListItem", null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="+")  # the material, for purchasing and MRP
    sort_order = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=200)
    unit = models.CharField(max_length=20)
    price = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    qty = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"),
                              validators=[MinValueValidator(Decimal("0"))])

    class Meta:
        ordering = ["sort_order", "id"]

    @property
    def line_sum(self) -> Decimal:
        return round_sum(self.qty, self.price)
