"""Servis (after-sales maintenance): masters (ustalar), service requests, photos and Telegram bot users.

A client reports a problem in the client bot / Mini App or by phone; an operator assigns a master; the master
works it from the master bot / Mini App; the client confirms and rates. See openspec change
`add-service-maintenance`.
"""

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel


class Master(AuditModel, SoftDeleteModel):
    TRACK = {"name": "F.I.O.", "phone": "Telefon", "region": "Hudud", "is_active": "Faol",
             "employee": "Xodim"}
    CHATTER_NAME = "Usta"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # US-0001
    name = models.CharField("F.I.O.", max_length=200)
    phone = models.CharField("Telefon", max_length=32, db_index=True)
    region = models.CharField("Hudud", max_length=100, blank=True, default="")
    skills = models.CharField("Ixtisoslik", max_length=255, blank=True, default="")
    employee = models.OneToOneField("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="master")
    is_active = models.BooleanField("Faol", default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["name"]
        verbose_name = "Usta"
        verbose_name_plural = "Ustalar"

    def __str__(self) -> str:
        return self.name


class RequestKind(models.TextChoices):
    ADJUST = "adjust", "Rostlash"
    HARDWARE = "hardware", "Furnitura"
    GLASS = "glass", "Oyna / paket"
    NET = "net", "Maskitka"
    SEAL = "seal", "Germetik, shamol kiradi"
    INSTALL = "install", "Qayta o'rnatish"
    OTHER = "other", "Boshqa"


class RequestStatus(models.TextChoices):
    NEW = "new", "Yangi"
    ASSIGNED = "assigned", "Ustaga berildi"
    ACCEPTED = "accepted", "Usta qabul qildi"
    IN_PROGRESS = "in_progress", "Bajarilmoqda"
    DONE = "done", "Bajarildi"
    CLOSED = "closed", "Yopildi"
    CANCELLED = "cancelled", "Bekor qilindi"


class RequestSource(models.TextChoices):
    BOT = "bot", "Telegram bot"
    PHONE = "phone", "Telefon"
    ERP = "erp", "ERP"


S = RequestStatus

# Allowed moves. services.request_change_status rejects anything else.
TRANSITIONS: dict[str, set[str]] = {
    S.NEW: {S.ASSIGNED, S.CANCELLED},
    S.ASSIGNED: {S.ACCEPTED, S.NEW, S.CANCELLED},  # → new: the master declined or was taken off
    S.ACCEPTED: {S.IN_PROGRESS, S.NEW, S.CANCELLED},
    S.IN_PROGRESS: {S.DONE, S.CANCELLED},
    S.DONE: {S.CLOSED, S.IN_PROGRESS},  # → in_progress: the client says it isn't fixed
    S.CLOSED: set(),
    S.CANCELLED: set(),
}
OPEN_STATUSES = {S.NEW, S.ASSIGNED, S.ACCEPTED, S.IN_PROGRESS, S.DONE}
MASTER_ACTIVE_STATUSES = {S.ASSIGNED, S.ACCEPTED, S.IN_PROGRESS}


class ServiceRequest(AuditModel, SoftDeleteModel):
    TRACK = {
        "status": "Holat", "master": "Usta", "scheduled_at": "Vaqt", "kind": "Turi", "is_warranty": "Kafolat",
        "price": "Narx", "address": "Manzil", "project": "Loyiha", "rating": "Baho",
    }
    CHATTER_NAME = "Servis arizasi"

    code = models.CharField(max_length=24, unique=True, null=True, editable=False)  # SV-26-00001
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.NEW,
                              db_index=True)
    source = models.CharField(max_length=10, choices=RequestSource.choices, default=RequestSource.ERP)
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="service_requests")
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="service_requests")
    kind = models.CharField("Turi", max_length=20, choices=RequestKind.choices, default=RequestKind.OTHER)
    description = models.TextField("Muammo")
    phone = models.CharField("Telefon", max_length=32, blank=True, default="")
    address = models.CharField("Manzil", max_length=500, blank=True, default="")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    preferred_date = models.DateField("Qulay sana", null=True, blank=True)
    is_warranty = models.BooleanField("Kafolat", default=False)
    price = models.DecimalField("Narx", max_digits=18, decimal_places=2, default=Decimal("0"),
                                validators=[MinValueValidator(Decimal("0"))])

    master = models.ForeignKey(Master, null=True, blank=True, on_delete=models.PROTECT,
                               related_name="requests")
    scheduled_at = models.DateTimeField("Vaqt", null=True, blank=True, db_index=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    report = models.TextField("Usta hisoboti", blank=True, default="")
    cancel_reason = models.CharField(max_length=500, blank=True, default="")

    rating = models.PositiveSmallIntegerField("Baho", null=True, blank=True,
                                              validators=[MinValueValidator(1), MaxValueValidator(5)])
    feedback = models.TextField("Mijoz fikri", blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Servis arizasi"
        verbose_name_plural = "Servis arizalari"

    def __str__(self) -> str:
        return self.code or f"Servis #{self.pk}"

    @property
    def allowed_statuses(self) -> list[str]:
        return sorted(TRANSITIONS[self.status])


class PhotoStage(models.TextChoices):
    BEFORE = "before", "Muammo"
    AFTER = "after", "Bajarilgan ish"


def photo_path(instance, filename: str) -> str:
    return f"service/{instance.request_id}/{filename}"


class ServicePhoto(models.Model):
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="photos")
    stage = models.CharField(max_length=10, choices=PhotoStage.choices, default=PhotoStage.BEFORE)
    file = models.FileField(upload_to=photo_path, max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.file.name


class BotKind(models.TextChoices):
    CLIENT = "client", "Mijoz bot"
    MASTER = "master", "Usta bot"


class BotUser(models.Model):
    """A Telegram user of one of the two bots. Linked to a client / master after sharing a phone number."""

    bot = models.CharField(max_length=10, choices=BotKind.choices)
    tg_id = models.BigIntegerField()
    chat_id = models.BigIntegerField()
    username = models.CharField(max_length=64, blank=True, default="")
    first_name = models.CharField(max_length=128, blank=True, default="")
    last_name = models.CharField(max_length=128, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="")
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="bot_users")
    master = models.ForeignKey(Master, null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="bot_users")
    blocked = models.BooleanField(default=False)  # the user blocked the bot: stop sending
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["bot", "tg_id"], name="uniq_bot_user")]

    def __str__(self) -> str:
        return f"{self.bot}:{self.tg_id}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.username or str(self.tg_id)
