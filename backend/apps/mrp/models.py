"""MRP (add-bom, add-project-materials, add-mrp; ADR 0012): bills of materials, what each Loyiha item is,
the Loyiha's frozen material list. The plan itself is computed, never stored (design D6)."""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel

ZERO = Decimal("0")


class Basis(models.TextChoices):
    DONA = "dona", "Bir donaga"
    M2 = "m2", "1 m² ga"


class Bom(AuditModel, SoftDeleteModel):
    """Tarkib: what one finished (or semi-finished) product is made of. One active version per product."""

    TRACK = {"name": "Nomi", "product": "Mahsulot", "is_active": "Faol", "notes": "Izoh"}
    CHATTER_NAME = "Tarkib"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # BM-00001
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="boms")
    name = models.CharField("Nomi", max_length=200, blank=True, default="")
    version = models.PositiveSmallIntegerField(default=1)
    is_active = models.BooleanField(default=True, db_index=True)
    previous = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["product__name", "-version"]
        verbose_name = "Tarkib"
        verbose_name_plural = "Tarkiblar"

    def __str__(self):
        return f"{self.code} v{self.version}" if self.code else f"BM #{self.pk}"


class BomLine(models.Model):
    bom = models.ForeignKey(Bom, on_delete=models.CASCADE, related_name="lines")
    component = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="used_in")
    sort_order = models.PositiveSmallIntegerField(default=0)
    qty = models.DecimalField(max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0.0001"))])
    basis = models.CharField(max_length=4, choices=Basis.choices, default=Basis.DONA)
    waste_pct = models.DecimalField(max_digits=5, decimal_places=2, default=ZERO,
                                    validators=[MinValueValidator(ZERO)])
    note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.component} {self.qty.normalize():f}/{self.basis}"


class ItemSpec(models.Model):
    """What a Loyiha item is (add-project-materials). Loyiha items are re-created on every edit, so the
    choice is keyed by the item's position and remembers its product type: a spec whose type no longer
    matches the item at that position is ignored."""

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="item_specs")
    position = models.PositiveSmallIntegerField()  # 0-based index of the item in the Loyiha's item order
    product_type = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name="+")
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["project_id", "position"]
        constraints = [models.UniqueConstraint(fields=["project", "position"], name="itemspec_unique_position")]

    def __str__(self):
        return f"{self.project_id}#{self.position} → {self.product_id}"


class ProjectMaterial(models.Model):
    """The Loyiha's material list frozen at confirmation (design D4)."""

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="materials")
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="+")
    qty = models.DecimalField(max_digits=14, decimal_places=3)
    frozen_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["project_id", "id"]
        constraints = [models.UniqueConstraint(fields=["project", "product"], name="projectmaterial_unique")]

    def __str__(self):
        return f"{self.project_id}: {self.product_id} {self.qty}"
