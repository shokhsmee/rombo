from decimal import Decimal

from django.db import models

from apps.core.models import TimeStampedModel


class Company(TimeStampedModel):
    """Singleton (pk=1): who "Sotuvchi" is on every contract. Edited in Sozlamalar → Kompaniya."""

    name = models.CharField("Nomi", max_length=200)
    legal_form = models.CharField("Tashkiliy shakli", max_length=20, blank=True, default="")
    director = models.CharField("Direktor (to'liq)", max_length=150, blank=True, default="")
    director_short = models.CharField("Direktor (qisqa)", max_length=80, blank=True, default="")
    city = models.CharField("Shahar", max_length=80, blank=True, default="")
    address = models.CharField("Manzil", max_length=255, blank=True, default="")
    bank_account = models.CharField("Hisob raqami (X/R)", max_length=40, blank=True, default="")
    bank_name = models.CharField("Bank", max_length=150, blank=True, default="")
    mfo = models.CharField("MFO", max_length=10, blank=True, default="")
    inn = models.CharField("STIR (INN)", max_length=14, blank=True, default="")
    phone = models.CharField("Telefon", max_length=40, blank=True, default="")
    delivery_days = models.PositiveSmallIntegerField("Topshirish muddati, bank kuni", default=25)
    prepay_percent = models.PositiveSmallIntegerField("Oldindan to'lov, %", default=50)
    # Buxgalteriya (add-accounting): VAT status decides whether invoices carry QQS; lock_date closes periods
    vat_payer = models.BooleanField("QQS to'lovchi", default=False)
    vat_code = models.CharField("QQS ro'yxat kodi", max_length=20, blank=True, default="")
    vat_rate = models.DecimalField("QQS stavkasi, %", max_digits=5, decimal_places=2, default=Decimal("12"))
    lock_date = models.DateField("Davr yopilgan sana", null=True, blank=True)

    class Meta:
        verbose_name = "Kompaniya"
        verbose_name_plural = "Kompaniya"

    def __str__(self):
        return self.name

    @classmethod
    def get(cls) -> "Company":
        obj, _ = cls.objects.get_or_create(pk=1, defaults={"name": "Rombo"})
        return obj
