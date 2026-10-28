"""Employees' own Telegram accounts and their chats (ported from uzbridge tgchat).

An Account is one employee's Telegram login (a user account over MTProto, Telethon — not a bot): its session is
encrypted. A Chat is metadata only — who, unread count, read marks, a small avatar, the client / lead it belongs
to. Message text and files are never stored: they are read live from Telegram and pushed to the owner's browser.
"""

from django.conf import settings
from django.db import models

from apps.core.crypto import EncryptedTextField
from apps.core.models import AuditModel


class Account(AuditModel):
    class Status(models.TextChoices):
        NEW = "new", "Ulanmagan"
        CODE_SENT = "code_sent", "Kod yuborildi"
        PASSWORD = "password", "2FA parol kerak"
        CONNECTED = "connected", "Ulangan"
        ERROR = "error", "Xato"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="telegram_accounts")
    name = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=20, unique=True)
    api_id = models.PositiveIntegerField(null=True, blank=True)  # own my.telegram.org app; empty = the install's
    api_hash = EncryptedTextField(blank=True, default="")
    session = EncryptedTextField(blank=True, default="")  # Telethon StringSession once signed in
    login_session = EncryptedTextField(blank=True, default="")  # between "send code" and "sign in"
    code_hash = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    error = models.CharField(max_length=255, blank=True, default="")
    tg_user_id = models.BigIntegerField(null=True, blank=True)
    tg_name = models.CharField(max_length=150, blank=True, default="")
    tg_username = models.CharField(max_length=64, blank=True, default="")
    auto_clients = models.BooleanField(default=True)  # a new private chat becomes a Mijoz
    crm_leads = models.BooleanField(default=False)  # … and a lead
    active = models.BooleanField(default=True)
    last_sync = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "Telegram akkaunt"
        verbose_name_plural = "Telegram akkauntlar"

    def __str__(self):
        return self.name or self.phone

    @property
    def connected(self) -> bool:
        return bool(self.session) and self.status == self.Status.CONNECTED

    def credentials(self) -> tuple[int, str]:
        if self.api_id and self.api_hash:
            return self.api_id, self.api_hash
        return settings.TELEGRAM_API_ID, settings.TELEGRAM_API_HASH


class Chat(models.Model):
    class Kind(models.TextChoices):
        PRIVATE = "private", "Shaxsiy"
        GROUP = "group", "Guruh"
        CHANNEL = "channel", "Kanal"

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="chats")
    chat_id = models.BigIntegerField()  # Telegram's marked peer id (negative for groups / channels)
    access_hash = models.BigIntegerField(null=True, blank=True)
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.PRIVATE)
    name = models.CharField(max_length=200, blank=True, default="")
    username = models.CharField(max_length=64, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="tg_chats")
    lead = models.ForeignKey("crm.Lead", null=True, blank=True, on_delete=models.SET_NULL, related_name="tg_chats")
    unread = models.PositiveIntegerField(default=0)
    last_read_out = models.BigIntegerField(default=0)  # our messages up to this id were read (double ticks)
    last_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_out = models.BooleanField(default=False)
    photo = models.BinaryField(null=True, blank=True)  # a small avatar
    photo_at = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-last_at", "-id"]
        constraints = [models.UniqueConstraint(fields=["account", "chat_id"], name="uniq_tg_chat")]

    def __str__(self):
        return self.name

    @property
    def shared_ids(self) -> bool:
        """Private chats and small groups share one message-id space per account (deletes name no chat)."""
        return self.chat_id > -1_000_000_000_000
