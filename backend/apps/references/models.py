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


class UomCategory(models.TextChoices):
    COUNT = "count", "Dona"
    LENGTH = "length", "Uzunlik"
    AREA = "area", "Yuza"
    WEIGHT = "weight", "Og'irlik"
    VOLUME = "volume", "Hajm"
    OTHER = "other", "Boshqa"  # komplekt, pachka, xizmat: each converts only to itself


class Uom(AuditModel):
    """A unit of measure (add-units-of-measure). Products store its canonical `name`; document lines keep their
    own text (шт, м) and are resolved through `aliases` when a quantity must be converted."""

    name = models.CharField("Nomi", max_length=20, unique=True)  # dona, m, m2, kg
    category = models.CharField(max_length=10, choices=UomCategory.choices, default=UomCategory.COUNT)
    # how many base units of the category one of this is: m = 1, sm = 0.01, g = 0.001
    ratio = models.DecimalField("Nisbat", max_digits=16, decimal_places=6, default=1)
    aliases = models.CharField("Boshqa yozilishi", max_length=200, blank=True, default="")  # "шт, ta, pcs"
    sort_order = models.PositiveSmallIntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name = "O'lchov birligi"
        verbose_name_plural = "O'lchov birliklari"

    def __str__(self):
        return self.name

    def spellings(self) -> set[str]:
        return {norm_unit(self.name), *(norm_unit(a) for a in self.aliases.split(",") if a.strip())}


def norm_unit(text: str) -> str:
    """How unit text is compared: case, spaces, dots and ² don't matter ("Шт." = "шт", "m²" = "m2")."""
    return (text or "").strip().lower().replace(".", "").replace(" ", "").replace("²", "2").replace("³", "3")
