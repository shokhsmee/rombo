from django.core.validators import MinLengthValidator, RegexValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel


class ClientKind(models.TextChoices):
    INDIVIDUAL = "individual", "Jismoniy shaxs"
    COMPANY = "company", "Yuridik shaxs"
    DEALER = "dealer", "Diler / hamkor"


tin_validator = RegexValidator(r"^\d{9,14}$", "STIR 9–14 ta raqamdan iborat bo'lishi kerak")


class Client(AuditModel, SoftDeleteModel):
    TRACK = {
        "name": "Nomi", "kind": "Turi", "tin": "STIR", "phone": "Telefon", "contact_person": "Aloqa shaxsi",
        "region": "Hudud", "manager": "Menejer", "is_active": "Faol", "segment": "Segment", "passport": "Pasport",
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
