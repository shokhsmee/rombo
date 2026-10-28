from django.conf import settings
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel


class EmployeeStatus(models.TextChoices):
    ACTIVE = "active", "Ishlamoqda"
    ON_LEAVE = "on_leave", "Ta'tilda"
    DISMISSED = "dismissed", "Bo'shagan"


class Employee(AuditModel, SoftDeleteModel):
    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # XD-0001
    last_name = models.CharField("Familiya", max_length=100, db_index=True)
    first_name = models.CharField("Ism", max_length=100)
    middle_name = models.CharField("Otasining ismi", max_length=100, blank=True, default="")

    phone = models.CharField(max_length=32, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    department = models.CharField("Bo'lim", max_length=120, blank=True, default="", db_index=True)
    position = models.CharField("Lavozim", max_length=120, blank=True, default="")
    hire_date = models.DateField(null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=EmployeeStatus.choices, default=EmployeeStatus.ACTIVE,
                              db_index=True)
    address = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="employee")

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "Xodim"
        verbose_name_plural = "Xodimlar"

    def __str__(self):
        return self.name

    @property
    def name(self) -> str:
        """Display name — used by Ref payloads everywhere an employee is referenced."""
        return " ".join(p for p in (self.last_name, self.first_name) if p)
