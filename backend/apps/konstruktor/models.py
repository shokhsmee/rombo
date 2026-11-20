"""Window constructor (add-window-constructor; ADR 0015): profile systems (workshop rules as data) and the
constructions of a Loyiha drawn as a split tree. The engine (`engine/`) turns a construction into pieces;
its output is stored on the construction, so a later system change never re-cuts an existing order."""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel

ZERO = Decimal("0")


def mm(label: str, default: str, **kw):
    return models.DecimalField(label, max_digits=7, decimal_places=1, default=Decimal(default),
                               validators=[MinValueValidator(ZERO)], **kw)


class Unit(models.TextChoices):
    BARS = "bars", "xlist"
    M = "m", "m"
    M2 = "m2", "m²"
    PCS = "pcs", "dona"


class Role(models.TextChoices):
    """What the engine counts. A price-list item is mapped to one role (× factor)."""

    FRAME = "frame", "Rom profili (L)"
    SASH = "sash", "Tabaqa profili (Z)"
    DOOR_SASH = "door_sash", "Eshik tabaqasi profili"
    MULLION = "mullion", "Impost profili (T)"
    BEAD = "bead", "Shtapik"
    RUBBER_GLASS = "rubber_glass", "Oyna rezinasi (oyna perimetri)"
    RUBBER_SASH = "rubber_sash", "Tabaqa rezinasi (tabaqa perimetri)"
    RUBBER_FRAME = "rubber_frame", "Rom rezinasi (rom ichki perimetri)"
    AREA = "area_m2", "Konstruksiya maydoni"
    PANEL = "panel_m2", "Panel maydoni"
    LAMBRI = "lambri_m2", "Lambri maydoni"
    CONSTRUCTIONS = "constructions", "Har konstruksiyaga"
    SASH_ANY = "sash_count", "Har tabaqaga"
    TURN = "turn", "Burilma tabaqa"
    TILT = "tilt", "Fortochka (qiyalama)"
    TILT_TURN = "tilt_turn", "Burilma-qiyalama tabaqa (PVO)"
    DOOR = "door", "Eshik tabaqasi"
    MULLION_COUNT = "mullion_count", "Har impostga"
    MULLION_ENDS = "mullion_ends", "Impost uchlari (ulagich)"
    GLASS_UNITS = "glass_units", "Oyna paketi (dona)"


BAR_ROLES = {Role.FRAME, Role.SASH, Role.DOOR_SASH, Role.MULLION, Role.BEAD}
LENGTH_ROLES = {Role.RUBBER_GLASS, Role.RUBBER_SASH, Role.RUBBER_FRAME}
AREA_ROLES = {Role.AREA, Role.PANEL, Role.LAMBRI}
ROLE_UNIT = {**{r: Unit.BARS for r in BAR_ROLES}, **{r: Unit.M for r in LENGTH_ROLES},
             **{r: Unit.M2 for r in AREA_ROLES}}


def role_unit(role: str) -> str:
    return ROLE_UNIT.get(role, Unit.PCS)


class ProfileSystem(AuditModel, SoftDeleteModel):
    """One profile series as the workshop makes it: its price list, bar and saw, widths and deductions."""

    TRACK = {
        "name": "Nomi", "price_list": "Narx ro'yxati", "bar_length_mm": "Xlist uzunligi", "kerf_mm": "Arra qalinligi",
        "trim_mm": "Uch kesimi", "frame_width": "Rom eni", "mullion_width": "Impost eni", "sash_width": "Tabaqa eni",
        "weld_allowance": "Payvand zaxirasi", "mullion_allowance": "Impost zaxirasi", "sash_overlap": "Tabaqa ustamasi",
        "glass_deduction_fixed": "Oyna ayirmasi (qo'zg'almas)", "glass_deduction_sash": "Oyna ayirmasi (tabaqa)",
        "bead_allowance": "Shtapik zaxirasi", "junk_pct": "Chiqindi %", "default_glass": "Asosiy oyna",
        "needs_check": "Tekshirilmagan", "is_active": "Faol",
    }
    CHATTER_NAME = "Profil tizimi"

    name = models.CharField("Nomi", max_length=150, unique=True)
    price_list = models.ForeignKey("pricing.PriceList", on_delete=models.PROTECT, related_name="profile_systems")
    product_type = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.PROTECT,
                                     related_name="+", limit_choices_to={"kind": "product_type"})
    bar_length_mm = models.DecimalField("Xlist uzunligi, mm", max_digits=7, decimal_places=1, default=Decimal("6500"),
                                        validators=[MinValueValidator(Decimal("1000"))])
    kerf_mm = mm("Arra qalinligi, mm", "5")
    trim_mm = mm("Xlist uchlari kesimi, mm", "0")
    frame_width = mm("Rom eni, mm", "60")
    mullion_width = mm("Impost eni, mm", "80")
    sash_width = mm("Tabaqa eni, mm", "76")
    weld_allowance = mm("Payvand zaxirasi (har uchi), mm", "3")
    mullion_allowance = mm("Impost zaxirasi, mm", "6")
    sash_overlap = mm("Tabaqa ustamasi (har tomon), mm", "8")
    glass_deduction_fixed = mm("Oyna ayirmasi — qo'zg'almas, mm", "10")
    glass_deduction_sash = mm("Oyna ayirmasi — tabaqada, mm", "10")
    bead_allowance = mm("Shtapik zaxirasi, mm", "0")
    junk_pct = models.DecimalField("Chiqindi (metrli mollar), %", max_digits=5, decimal_places=2, default=Decimal("3"),
                                   validators=[MinValueValidator(ZERO)])
    default_glass = models.ForeignKey("pricing.PriceListItem", null=True, blank=True, on_delete=models.SET_NULL,
                                      related_name="+")
    needs_check = models.BooleanField("Sex tasdiqlamagan", default=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["name"]
        verbose_name = "Profil tizimi"
        verbose_name_plural = "Profil tizimlari"

    def __str__(self):
        return self.name


class ProfileSystemItem(models.Model):
    """Role → price-list item: "frame" → "L -ka" (bars after cutting), "door" × 3 → "Петля дверная 3ска"."""

    system = models.ForeignKey(ProfileSystem, on_delete=models.CASCADE, related_name="items")
    sort_order = models.PositiveSmallIntegerField(default=0)
    role = models.CharField(max_length=20, choices=Role.choices)
    price_list_item = models.ForeignKey("pricing.PriceListItem", on_delete=models.CASCADE, related_name="+")
    factor = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal("1"),
                                 validators=[MinValueValidator(ZERO)])
    round_up = models.BooleanField("Butunga yaxlitlash", default=False)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [models.UniqueConstraint(fields=["system", "role", "price_list_item"],
                                               name="konstruktor_item_unique")]

    def __str__(self):
        return f"{self.role} → {self.price_list_item_id}"


class Construction(AuditModel, SoftDeleteModel):
    """One window / door / balcony block of a Loyiha (KS-00001), drawn as a split tree."""

    TRACK = {"name": "Nomi", "system": "Profil tizimi", "product_type": "Buyurtma turi", "count": "Soni",
             "size_label": "O'lcham", "notes": "Izoh"}
    CHATTER_NAME = "Konstruksiya"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="constructions")
    system = models.ForeignKey(ProfileSystem, on_delete=models.PROTECT, related_name="constructions")
    product_type = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.PROTECT,
                                     related_name="+", limit_choices_to={"kind": "product_type"})
    name = models.CharField("Nomi", max_length=150, blank=True, default="")
    sort_order = models.PositiveSmallIntegerField(default=0)
    count = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    design = models.JSONField(default=dict)
    result = models.JSONField(default=dict, editable=False)  # engine output, recomputed only on save
    area_m2 = models.DecimalField(max_digits=10, decimal_places=4, default=ZERO, editable=False)
    size_label = models.CharField(max_length=60, blank=True, default="", editable=False)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["project_id", "sort_order", "id"]
        verbose_name = "Konstruksiya"
        verbose_name_plural = "Konstruksiyalar"

    def __str__(self):
        return self.code or f"KS #{self.pk}"
