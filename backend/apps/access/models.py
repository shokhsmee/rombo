from django.db import models

from apps.core.models import AuditModel


class Role(AuditModel):
    TRACK = {"name": "Nomi", "description": "Tavsif"}
    CHATTER_NAME = "Rol"

    name = models.CharField("Nomi", max_length=100, unique=True)
    description = models.TextField("Tavsif", blank=True, default="")
    is_system = models.BooleanField(default=False, help_text="Seed qilingan rollarni o'chirib bo'lmaydi")

    class Meta:
        ordering = ["name"]
        verbose_name = "Rol"
        verbose_name_plural = "Rollar"

    def __str__(self):
        return self.name


class RolePermission(models.Model):
    """One row per (role, page). No row == no access at all."""

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="permissions")
    page_key = models.CharField(max_length=64)
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["role", "page_key"], name="uq_role_page")]

    def __str__(self):
        return f"{self.role_id}:{self.page_key}"
