from django.db import models

from apps.core.models import AuditModel


class Currency(models.TextChoices):
    UZS = "UZS", "so'm"
    USD = "USD", "USD"


class PriceList(AuditModel):
    """Components and prices of one product series, e.g. "Rombo Termo 306J 65 seriya" (bar 6.5 m)."""

    TRACK = {"name": "Nomi", "currency": "Valyuta", "bar_length_m": "Profil uzunligi", "is_active": "Faol"}
    CHATTER_NAME = "Narx ro'yxati"

    name = models.CharField("Nomi", max_length=150, unique=True)
    product_type = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.PROTECT,
                                     related_name="+", limit_choices_to={"kind": "product_type"})
    bar_length_m = models.DecimalField("Profil uzunligi, m", max_digits=5, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.USD)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["name"]
        verbose_name = "Narx ro'yxati"
        verbose_name_plural = "Narx ro'yxatlari"

    def __str__(self):
        return self.name


class PriceListItem(models.Model):
    """One component line of the hisob-kitob template: name, unit, unit price."""

    price_list = models.ForeignKey(PriceList, on_delete=models.CASCADE, related_name="items")
    sort_order = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=200)
    unit = models.CharField("O'lchov birligi", max_length=20)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.name
