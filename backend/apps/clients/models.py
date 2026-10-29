from django.core.validators import MaxValueValidator, MinLengthValidator, MinValueValidator, RegexValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel


class ClientKind(models.TextChoices):
    INDIVIDUAL = "individual", "Jismoniy shaxs"
    COMPANY = "company", "Yuridik shaxs"
    DEALER = "dealer", "Diler / hamkor"
    SUPPLIER = "supplier", "Yetkazib beruvchi"  # ADR 0008: suppliers are clients, shown under Ta'minot


class PriceCurrency(models.TextChoices):
    UZS = "UZS", "so'm"
    USD = "USD", "USD"


# Loyiha statuses that are done with the client — mirrors projects.models.FINISHED_STATUSES
# (clients must not import projects; a test keeps the two equal).
FINISHED_PROJECT_STATUSES = ("delivered", "closed", "cancelled")

tin_validator =RegexValidator(r"^\d{9,14}$", "STIR 9–14 ta raqamdan iborat bo'lishi kerak")


class Client(AuditModel, SoftDeleteModel):
    TRACK = {
        "name": "Nomi", "kind": "Turi", "tin": "STIR", "phone": "Telefon", "contact_person": "Aloqa shaxsi",
        "region": "Hudud", "manager": "Menejer", "is_active": "Faol", "segment": "Segment", "passport": "Pasport",
        "latitude": "Kenglik", "longitude": "Uzunlik", "bank_account": "Hisob raqami", "bank_name": "Bank",
        "mfo": "MFO", "price_currency": "Narx valyutasi", "prepay_percent": "Oldindan to'lov %",
        "credit_days": "Kredit kunlari",
    }
    CHATTER_NAME = "Mijoz"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # MJ-00001
    kind = models.CharField(max_length=20, choices=ClientKind.choices, default=ClientKind.INDIVIDUAL,
                            db_index=True)
    name = models.CharField("Nomi / F.I.O.", max_length=255, db_index=True, validators=[MinLengthValidator(2)])
    tin = models.CharField("STIR", max_length=14, blank=True, default="", db_index=True,
                           validators=[tin_validator])
    contact_person = models.CharField(max_length=200, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="", db_index=True)
    phone_extra = models.CharField(max_length=32, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    region = models.CharField("Hudud", max_length=100, blank=True, default="", db_index=True)
    address = models.CharField(max_length=255, blank=True, default="")
    passport = models.CharField("Pasport", max_length=30, blank=True, default="")  # printed on the contract
    source = models.CharField("Qayerdan kelgan", max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    # point on the map (6 decimals ≈ 11 cm); both set or both empty — see services._check_point
    latitude = models.DecimalField("Kenglik", max_digits=9, decimal_places=6, null=True, blank=True,
                                   validators=[MinValueValidator(-90), MaxValueValidator(90)])
    longitude = models.DecimalField("Uzunlik", max_digits=9, decimal_places=6, null=True, blank=True,
                                    validators=[MinValueValidator(-180), MaxValueValidator(180)])

    # requisites of companies, dealers and suppliers; printed on orders and reconciliation acts
    bank_account = models.CharField("Hisob raqami", max_length=40, blank=True, default="")
    bank_name = models.CharField("Bank", max_length=150, blank=True, default="")
    mfo = models.CharField("MFO", max_length=10, blank=True, default="")
    # supplier terms (kind = supplier): the currency of their price list, prepayment share, credit days
    price_currency = models.CharField("Narx valyutasi", max_length=3, choices=PriceCurrency.choices,
                                      default=PriceCurrency.UZS)
    prepay_percent = models.PositiveSmallIntegerField("Oldindan to'lov, %", null=True, blank=True,
                                                      validators=[MaxValueValidator(100)])
    credit_days = models.PositiveSmallIntegerField("Kredit kunlari", null=True, blank=True)

    manager = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="clients")
    segment = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="+", limit_choices_to={"kind": "client_segment"})

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Mijoz"
        verbose_name_plural = "Mijozlar"

    def __str__(self):
        return self.name
