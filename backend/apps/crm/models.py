"""CRM (voronka, lids, their tasks) and telephony (calls, extensions, connections), ported from uzbridge.

    Pipeline ── Stage[] ── Lead[] ── LeadTask[]   a lead sits in one stage; won / lost are terminal stages
                └ LostReason[]
    LeadField          a field the company adds to the lead card; values in Lead.custom / ClientData.custom
    Connection         a telephony provider (UTeL, Moi Zvonki, IP-PBX) or a lead source (form, Yuboraman, amoCRM):
                       config, encrypted secrets and a random token that makes its webhook URL
    Call               one phone call: webhook, history sync or the browser phone, linked to a lead / client by phone
    Extension          a user's internal number and SIP login for the browser phone
    TelephonySettings  one row: what calls do in the CRM
    CrmSettings        one row: task types, kanban card, duplicates, distribution, Drive recordings
    GoogleAccount      one row: the Drive that keeps call recordings

Notes, stage changes and calls go to the lead's chatter; a lead becomes a Mijoz + Loyiha on conversion.
"""

import json
import secrets
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.crypto import EncryptedTextField
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
DEFAULT_TASK_TYPES = ["Qo'ng'iroq", "Uchrashuv", "O'lchov", "Xabar yozish", "Boshqa"]
CALL_TASK = "Qo'ng'iroq"
DEFAULT_CARD_FIELDS = ["customer", "phone", "budget", "tags", "source", "manager", "task"]


def new_token() -> str:
    return secrets.token_urlsafe(24)


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


class LostReason(models.Model):
    """A reason offered when a lead is rejected (per pipeline; free text is allowed too)."""

    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="lost_reasons")
    text = models.CharField(max_length=120)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.text


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
    tags = models.JSONField(default=list, blank=True)  # ["aksiya", "sayt"]
    custom = models.JSONField(default=dict, blank=True)  # {LeadField.key: value} — deal and extra sections

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["pipeline", "stage"])]
        verbose_name = "Lid"
        verbose_name_plural = "Lidlar"

    def __str__(self):
        return f"{self.code} {self.title}"


class LeadField(models.Model):
    """A field the company adds to the lead card (amoCRM «Поля»): rooms, profile colour, visit date…"""

    class Type(models.TextChoices):
        TEXT = "text", "Matn"
        NUMBER = "number", "Son"
        DATE = "date", "Sana"
        SELECT = "select", "Ro'yxat"
        PHONE = "phone", "Telefon"
        URL = "url", "Havola"
        BOOL = "bool", "Ha / yo'q"

    class Section(models.TextChoices):
        DEAL = "deal", "Bitim"
        CONTACT = "contact", "Mijoz"  # belongs to the client: all their leads show it
        EXTRA = "extra", "Qo'shimcha"

    section = models.CharField(max_length=8, choices=Section.choices, default=Section.EXTRA)
    key = models.SlugField(max_length=40, unique=True)
    label = models.CharField(max_length=80)
    type = models.CharField(max_length=8, choices=Type.choices, default=Type.TEXT)
    options = models.JSONField(default=list, blank=True)  # a select's choices
    position = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.label


class ClientData(models.Model):
    """Contact-section field values of a client (crm owns it: clients never imports crm)."""

    client = models.OneToOneField("clients.Client", on_delete=models.CASCADE, related_name="crm_data")
    custom = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.client}: {len(self.custom or {})}"


class LeadTask(AuditModel):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="tasks")
    kind = models.CharField("Turi", max_length=40, default=CALL_TASK)  # a name from CrmSettings.task_types
    text = models.CharField(max_length=500, blank=True, default="")
    due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="+")
    done = models.BooleanField(default=False, db_index=True)
    done_at = models.DateTimeField(null=True, blank=True)
    call = models.ForeignKey("Call", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")  # call-back
    reminded_at = models.DateTimeField(null=True, blank=True)  # the due reminder went out (crm_worker)

    class Meta:
        ordering = ["done", "due_at", "id"]
        verbose_name = "Vazifa"
        verbose_name_plural = "Vazifalar"

    def __str__(self):
        return self.text or self.kind


# ------------------------------------------------------------------ connections


class Connection(AuditModel):
    """A telephony provider (UTeL / Moi Zvonki / any IP-PBX) or a lead source (website form, Yuboraman, amoCRM)."""

    class Kind(models.TextChoices):
        UTEL = "utel", "UTeL"
        PBX = "pbx", "IP-telefoniya (PBX)"
        MOIZVONKI = "moizvonki", "Moi Zvonki"
        WEBHOOK = "webhook", "Sayt / forma"
        YUBORAMAN = "yuboraman", "Yuboraman"
        AMOCRM = "amocrm", "amoCRM"

    class Status(models.TextChoices):
        NEW = "new", "Yangi"
        OK = "ok", "Ishlayapti"
        ERROR = "error", "Xato"

    TELEPHONY = ("utel", "pbx", "moizvonki")

    kind = models.CharField(max_length=12, choices=Kind.choices)
    name = models.CharField(max_length=100)
    enabled = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)
    secrets = EncryptedTextField(blank=True, default="")  # JSON: api_key, password, client_secret, tokens…
    token = models.CharField(max_length=64, unique=True, default=new_token)
    status = models.CharField(max_length=6, choices=Status.choices, default=Status.NEW)
    last_error = models.TextField(blank=True, default="")
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_event_at = models.DateTimeField(null=True, blank=True)
    events_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["id"]
        verbose_name = "Ulanish"
        verbose_name_plural = "Ulanishlar"

    def __str__(self):
        return self.name

    @property
    def is_telephony(self) -> bool:
        return self.kind in self.TELEPHONY

    def get_secrets(self) -> dict:
        try:
            return json.loads(self.secrets or "{}")
        except ValueError:
            return {}

    def set_secrets(self, data: dict) -> None:
        clean = {k: v for k, v in (data or {}).items() if v not in (None, "")}
        self.secrets = json.dumps(clean) if clean else ""


class IntakeLog(models.Model):
    """A request / deal already taken from a lead source, so a re-send or a re-sync never duplicates it."""

    connection = models.ForeignKey(Connection, on_delete=models.CASCADE, related_name="intake")
    external_id = models.CharField(max_length=120)
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    duplicate = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["connection", "external_id"], name="uniq_crm_intake")]

    def __str__(self):
        return f"{self.connection_id}:{self.external_id}"


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
BAD_STATUSES = (CallStatus.MISSED, CallStatus.NO_ANSWER, CallStatus.BUSY, CallStatus.FAILED)


class Call(TimeStampedModel):
    """A log row from the PBX (webhook or history) or the browser phone. No record page: it shows in the call
    log and in the lead's / client's history."""

    class Source(models.TextChoices):
        WEBHOOK = "webhook", "PBX"
        SOFTPHONE = "softphone", "Brauzer telefoni"
        SYNC = "sync", "Tarix"

    external_id = models.CharField(max_length=120, unique=True)
    connection = models.ForeignKey(Connection, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="calls")
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.WEBHOOK)
    direction = models.CharField(max_length=8, choices=CallDirection.choices, default=CallDirection.IN,
                                 db_index=True)
    status = models.CharField(max_length=10, choices=CallStatus.choices, default=CallStatus.RINGING, db_index=True)
    from_number = models.CharField(max_length=40, blank=True, default="")
    to_number = models.CharField(max_length=40, blank=True, default="")
    client_phone = models.CharField(max_length=20, blank=True, default="", db_index=True)  # the outside party, +998…
    extension = models.CharField(max_length=120, blank=True, default="")  # 101, or a Moi Zvonki login (email)
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
    # the recording's copy in Google Drive (services.recordings), played through a signed Rombo link
    recording_file_id = models.CharField(max_length=120, blank=True, default="")
    recording_archived_at = models.DateTimeField(null=True, blank=True)
    recording_error = models.CharField(max_length=300, blank=True, default="")
    recording_attempts = models.PositiveSmallIntegerField(default=0)
    recording_next_at = models.DateTimeField(null=True, blank=True, db_index=True)  # the worker's next try
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
    number = models.CharField("Ichki raqam", max_length=120, unique=True)  # 101, or the Moi Zvonki login email
    connection = models.ForeignKey(Connection, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    sip_login = models.CharField(max_length=80, blank=True, default="")
    # Fernet in the DB; write-only in the API. With Moi Zvonki it holds the employee's own API key (click-to-call).
    sip_password = EncryptedTextField(blank=True, default="")
    softphone = models.BooleanField("Brauzer telefoni", default=False)

    class Meta:
        ordering = ["number"]
        verbose_name = "Ichki raqam"
        verbose_name_plural = "Ichki raqamlar"

    def __str__(self):
        return self.number


class UnknownAction(models.TextChoices):
    LEAD = "create_lead", "Lid yaratish"
    CLIENT = "create_contact", "Faqat mijoz yaratish"
    NOTHING = "nothing", "Hech narsa qilmaslik"


class DuplicatePolicy(models.TextChoices):
    OPEN_LEAD = "open_lead", "Ochiq lidiga yozish"
    ALWAYS_NEW = "always_new", "Har safar yangi lid"
    CONTACT_ONLY = "contact_only", "Faqat mijozga bog'lash"


class Responsible(models.TextChoices):
    OPERATOR = "operator", "Javob bergan xodim"
    OWNER = "contact_owner", "Mijozning menejeri"
    FIXED = "fixed", "Belgilangan xodim"


class TelephonySettings(models.Model):
    """One row (pk=1): what calls do in the CRM (uzbridge telephony.DEFAULTS). Provider addresses and keys
    live on the Connection rows."""

    enabled = models.BooleanField(default=True)
    missed_task = models.BooleanField(default=True)
    missed_task_minutes = models.PositiveSmallIntegerField(default=15)
    incoming_unknown = models.CharField(max_length=16, choices=UnknownAction.choices, default=UnknownAction.LEAD)
    missed_unknown = models.CharField(max_length=16, choices=UnknownAction.choices, default=UnknownAction.LEAD)
    outgoing_unknown = models.CharField(max_length=16, choices=UnknownAction.choices, default=UnknownAction.CLIENT)
    duplicate = models.CharField(max_length=16, choices=DuplicatePolicy.choices, default=DuplicatePolicy.OPEN_LEAD)
    pipeline = models.ForeignKey(Pipeline, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    stage = models.ForeignKey(Stage, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    responsible = models.CharField(max_length=16, choices=Responsible.choices, default=Responsible.OPERATOR)
    fixed_manager = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL,
                                      related_name="+")
    lead_title = models.CharField(max_length=150, default="Qo'ng'iroq: {phone}")
    source = models.ForeignKey("references.RefItem", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="+", limit_choices_to={"kind": "sales_channel"})
    tags = models.JSONField(default=list, blank=True)
    popup = models.BooleanField(default=True)
    min_duration = models.PositiveIntegerField(default=0)  # shorter answered calls stay out of the history
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Telefoniya sozlamalari"
        verbose_name_plural = "Telefoniya sozlamalari"

    def __str__(self):
        return "Telefoniya sozlamalari"


# ------------------------------------------------------------------ CRM settings


class DistributionMode(models.TextChoices):
    ROUND_ROBIN = "round_robin", "Navbat bilan"
    LEAST_OPEN = "least_open", "Eng kam yuklanganga"


class CrmSettings(models.Model):
    """One row (pk=1): task types, the kanban card, the duplicates and distribution add-ons, Drive recordings."""

    task_types = models.JSONField(default=list, blank=True)
    card_fields = models.JSONField(default=list, blank=True)
    duplicates_enabled = models.BooleanField(default=True)
    distribution_enabled = models.BooleanField(default=False)
    distribution_mode = models.CharField(max_length=12, choices=DistributionMode.choices,
                                         default=DistributionMode.ROUND_ROBIN)
    distribution_managers = models.JSONField(default=list, blank=True)  # employee ids, in queue order
    distribution_last = models.PositiveBigIntegerField(null=True, blank=True)
    # call recordings copied to Google Drive: only calls started after `recordings_since`
    recordings_enabled = models.BooleanField(default=False)
    recordings_folder_id = models.CharField(max_length=120, blank=True, default="")
    recordings_folder_url = models.CharField(max_length=300, blank=True, default="")
    recordings_since = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "CRM sozlamalari"
        verbose_name_plural = "CRM sozlamalari"

    def __str__(self):
        return "CRM sozlamalari"


class GoogleAccount(models.Model):
    """The Google account whose Drive keeps call recordings (OAuth, scope drive.file). One row (pk=1)."""

    email = models.CharField(max_length=254, blank=True, default="")
    refresh_token = EncryptedTextField(blank=True, default="")
    access_token = EncryptedTextField(blank=True, default="")
    expires_at = models.DateTimeField(null=True, blank=True)
    connected_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name="+")
    connected_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.email
