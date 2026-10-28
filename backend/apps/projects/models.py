from decimal import Decimal

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

# Header fields lock once the order reaches procurement: MRP plans are computed from them.
EDITABLE_STATUSES = {S.DRAFT, S.CONFIRMED}
FINISHED_STATUSES = {S.DELIVERED, S.CLOSED, S.CANCELLED}


class Currency(models.TextChoices):
    UZS = "UZS", "so'm"
    USD = "USD", "USD"


class Project(AuditModel, SoftDeleteModel):
    TRACK = {
        "status": "Holat", "name": "Nomi", "client": "Mijoz", "manager": "Menejer", "deadline": "Muddat",
        "amount": "Summa", "currency": "Valyuta", "contract_number": "Shartnoma №",
        "contract_date": "Shartnoma sanasi", "object_address": "Obyekt manzili", "region": "Hudud",
    }
    CHATTER_NAME = "Loyiha"

    code = models.CharField(max_length=24, unique=True, null=True, editable=False)  # LY-26-00001
    name = models.CharField("Nomi", max_length=255)
    status = models.CharField(max_length=20, choices=ProjectStatus.choices, default=ProjectStatus.DRAFT,
                              db_index=True)

    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="projects")
    manager = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="projects")

    object_address = models.CharField("Obyekt manzili", max_length=255, blank=True, default="")
    region = models.CharField(max_length=100, blank=True, default="")
    contract_number = models.CharField(max_length=50, blank=True, default="")
    contract_date = models.DateField(null=True, blank=True)
    deadline = models.DateField(null=True, blank=True, db_index=True)
    amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"),
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
