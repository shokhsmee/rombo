"""CRM (voronka, lids, their tasks) and telephony (calls, extensions), ported from uzbridge.

    Pipeline ── Stage[] ── Lead[] ── LeadTask[]   a lead sits in one stage; won / lost are terminal stages
    Call               one phone call: from the PBX webhook or the browser phone, linked to a lead / client by phone
    Extension          a user's internal number and SIP login for the browser phone
    TelephonySettings  one row: SIP WebSocket address, webhook token, what calls do in the CRM

Notes, stage changes and calls go to the lead's chatter; a lead becomes a Mijoz + Loyiha on conversion.
"""

import secrets
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel, TimeStampedModel


class Tone(models.TextChoices):
    """A stage's colour as a design token (frontend Pill tones), never a raw hex."""

    NEUTRAL = "neutral", "Kulrang"
    ACCENT = "accent", "Ko'k"
    INFO = "info", "Moviy"
    WARN = "warn", "Sariq"
    DONE = "done", "Binafsha"
    OK = "ok", "Yashil"
    BAD = "bad", "Qizil"


# name, tone, hint — the default voronka of a window factory: measuring is its own step
DEFAULT_STAGES = [
    ("Yangi", Tone.ACCENT, "Yangi murojaat — 15 daqiqada bog'laning"),
    ("Bog'lanildi", Tone.INFO, "Ehtiyoj aniqlandi"),
    ("O'lchov", Tone.DONE, "O'lchovchi obyektga boradi"),
    ("Taklif", Tone.WARN, "Narx va shartlar yuborildi"),
    ("Shartnoma", Tone.NEUTRAL, "Hujjatlar tayyorlanmoqda"),
]
DEFAULT_WON = ("Yutildi", Tone.OK)
DEFAULT_LOST = ("Rad etildi", Tone.BAD)
LOST_REASONS = ["Qimmat", "Boshqa joydan oldi", "Javob bermayapti", "Hozir kerak emas", "Noto'g'ri raqam"]


class Pipeline(AuditModel):
    name = models.CharField(max_length=100)
    position = models.PositiveSmallIntegerField(default=0)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = "Voronka"
        verbose_name_plural = "Voronkalar"

    def __str__(self):
        return self.name


class Stage(models.Model):
    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="stages")
    name = models.CharField(max_length=80)
    hint = models.CharField(max_length=200, blank=True, default="")
    position = models.PositiveSmallIntegerField(default=0)
    tone = models.CharField(max_length=10, choices=Tone.choices, default=Tone.NEUTRAL)
    is_won = models.BooleanField(default=False)
    is_lost = models.BooleanField(default=False)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = "Bosqich"
        verbose_name_plural = "Bosqichlar"

    def __str__(self):
        return self.name


class LeadStatus(models.TextChoices):
    OPEN = "open", "Ochiq"
    WON = "won", "Yutildi"
    LOST = "lost", "Rad etildi"


class Lead(AuditModel, SoftDeleteModel):
    TRACK = {
        "title": "Nomi", "stage": "Bosqich", "status": "Holat", "contact_name": "Aloqa shaxsi", "phone": "Telefon",
        "client": "Mijoz", "manager": "Menejer", "source": "Manba", "budget": "Byudjet", "region": "Hudud",
        "address": "Manzil", "lost_reason": "Rad sababi", "project": "Loyiha",
    }
    CHATTER_NAME = "Lid"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # LD-00001
    title = models.CharField("Nomi", max_length=200)
    pipeline = models.ForeignKey(Pipeline, on_delete=models.PROTECT, related_name="leads")
    stage = models.ForeignKey(Stage, on_delete=models.PROTECT, related_name="leads")
    status = models.CharField(max_length=8, choices=LeadStatus.choices, default=LeadStatus.OPEN, db_index=True)
    lost_reason = models.CharField(max_length=200, blank=True, default="")
    stage_changed_at = models.DateTimeField(auto_now_add=True)

    contact_name = models.CharField("Aloqa shaxsi", max_length=200, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="", db_index=True)
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="leads")
    manager = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="leads")
    source = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.PROTECT,
                               related_name="+", limit_choices_to={"kind": "sales_channel"})
    budget = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"),
                                 validators=[MinValueValidator(Decimal("0"))])
    region = models.CharField(max_length=100, blank=True, default="")
    address = models.CharField("Obyekt manzili", max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    # set on conversion: the order this lead became
    project = models.OneToOneField("projects.Project", null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="lead")

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["pipeline", "stage"])]
        verbose_name = "Lid"
        verbose_name_plural = "Lidlar"

    def __str__(self):
        return f"{self.code} {self.title}"


class TaskKind(models.TextChoices):
    CALL = "call", "Qo'ng'iroq"
    MEETING = "meeting", "Uchrashuv"
    MEASURE = "measure", "O'lchov"
    MESSAGE = "message", "Xabar yozish"
    OTHER = "other", "Boshqa"


class LeadTask(AuditModel):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="tasks")
    kind = models.CharField(max_length=10, choices=TaskKind.choices, default=TaskKind.CALL)
    text = models.CharField(max_length=500, blank=True, default="")
    due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="+")
    done = models.BooleanField(default=False, db_index=True)
    done_at = models.DateTimeField(null=True, blank=True)
    call = models.ForeignKey("Call", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")  # call-back

    class Meta:
        ordering = ["done", "due_at", "id"]
        verbose_name = "Vazifa"
        verbose_name_plural = "Vazifalar"

    def __str__(self):
        return self.text or self.get_kind_display()


# ------------------------------------------------------------------ telephony


class CallDirection(models.TextChoices):
    IN = "in", "Kiruvchi"
    OUT = "out", "Chiquvchi"
    INTERNAL = "internal", "Ichki"


class CallStatus(models.TextChoices):
    RINGING = "ringing", "Jiringlamoqda"
    TALKING = "talking", "Suhbatda"
    ANSWERED = "answered", "Javob berildi"
    MISSED = "missed", "O'tkazib yuborildi"
    NO_ANSWER = "no_answer", "Javob bermadi"
    BUSY = "busy", "Band"
    FAILED = "failed", "Ulanmadi"


LIVE_STATUSES = (CallStatus.RINGING, CallStatus.TALKING)


class Call(TimeStampedModel):
    """A log row from the PBX or the browser phone. No record page: it shows in the call log and in the
    lead's / client's history."""

    class Source(models.TextChoices):
        WEBHOOK = "webhook", "PBX"
        SOFTPHONE = "softphone", "Brauzer telefoni"

    external_id = models.CharField(max_length=120, unique=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.WEBHOOK)
    direction = models.CharField(max_length=8, choices=CallDirection.choices, default=CallDirection.IN,
                                 db_index=True)
    status = models.CharField(max_length=10, choices=CallStatus.choices, default=CallStatus.RINGING, db_index=True)
    from_number = models.CharField(max_length=40, blank=True, default="")
    to_number = models.CharField(max_length=40, blank=True, default="")
    client_phone = models.CharField(max_length=20, blank=True, default="", db_index=True)  # the outside party, +998…
    extension = models.CharField(max_length=40, blank=True, default="")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="+")
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="calls")
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.SET_NULL, related_name="calls")
    started_at = models.DateTimeField(db_index=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration = models.PositiveIntegerField(default=0)  # talk seconds
    wait = models.PositiveIntegerField(default=0)  # ring seconds
    recording_url = models.CharField(max_length=500, blank=True, default="")
    note = models.TextField(blank=True, default="")
    processed = models.BooleanField(default=False)  # the CRM rules ran on it
    created_lead = models.BooleanField(default=False)
    raw = models.JSONField(default=dict, blank=True)  # the last PBX events, for support

    class Meta:
        ordering = ["-started_at", "-id"]
        verbose_name = "Qo'ng'iroq"
        verbose_name_plural = "Qo'ng'iroqlar"

    def __str__(self):
        return f"{self.get_direction_display()} {self.client_phone or self.from_number}"


class Extension(models.Model):
    """A user's internal number on the PBX and the SIP login of their browser phone."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="extension")
    number = models.CharField("Ichki raqam", max_length=40, unique=True)
    sip_login = models.CharField(max_length=80, blank=True, default="")
    sip_password = models.CharField(max_length=128, blank=True, default="")  # write-only in the API
    softphone = models.BooleanField("Brauzer telefoni", default=False)

    class Meta:
        ordering = ["number"]
        verbose_name = "Ichki raqam"
        verbose_name_plural = "Ichki raqamlar"

    def __str__(self):
        return self.number


def new_token() -> str:
    return secrets.token_urlsafe(24)


class TelephonySettings(models.Model):
    """One row (pk=1). Addresses come from here (defaults from env), never from code."""

    enabled = models.BooleanField(default=True)
    sip_wss = models.CharField("SIP WebSocket", max_length=255, blank=True, default="")  # wss://pbx:8089/ws
    sip_domain = models.CharField(max_length=120, blank=True, default="")
    company_numbers = models.CharField("Kompaniya raqamlari", max_length=500, blank=True, default="")
    webhook_token = models.CharField(max_length=64, unique=True, default=new_token)
    incoming_creates_lead = models.BooleanField(default=True)
    missed_creates_lead = models.BooleanField(default=True)
    missed_task = models.BooleanField(default=True)
    missed_task_minutes = models.PositiveSmallIntegerField(default=15)
    last_event_at = models.DateTimeField(null=True, blank=True)  # last PBX webhook
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Telefoniya sozlamalari"
        verbose_name_plural = "Telefoniya sozlamalari"

    def __str__(self):
        return "Telefoniya sozlamalari"
