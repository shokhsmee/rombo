from django.db import models

from apps.core.models import AuditModel


class RefKind(models.TextChoices):
    SALES_CHANNEL = "sales_channel", "Sotuv kanali"
    PRODUCT_TYPE = "product_type", "Buyurtma turi"
    BRAND = "brand", "Brend"
    CLIENT_SEGMENT = "client_segment", "Mijoz segmenti"


class RefItem(AuditModel):
    """One entry of an editable list. Records point at it with on_delete=PROTECT: used items are
    deactivated, never deleted, so old orders keep their values."""

    kind = models.CharField(max_length=30, choices=RefKind.choices, db_index=True)
    name = models.CharField("Nomi", max_length=120)
    sort_order = models.PositiveSmallIntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["kind", "sort_order", "name"]
        constraints = [models.UniqueConstraint(fields=["kind", "name"], name="uq_refitem_kind_name")]
        verbose_name = "Ma'lumotnoma qiymati"
        verbose_name_plural = "Ma'lumotnomalar"

    def __str__(self):
        return self.name
