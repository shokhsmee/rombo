"""Personal tokens that let Claude (or any MCP client) act in the ERP as their owner. ADR 0014."""

from django.conf import settings
from django.db import models
from django.utils import timezone


class TokenScope(models.TextChoices):
    READ = "read", "Faqat o'qish"
    WRITE = "write", "O'qish va yozish"


class McpToken(models.Model):
    """The secret is shown once; only its SHA-256 and a short prefix are kept."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mcp_tokens")
    name = models.CharField("Nomi", max_length=100)
    prefix = models.CharField(max_length=16)  # "rmb_AbCd" — tells tokens apart in the list
    key_hash = models.CharField(max_length=64, unique=True)
    scope = models.CharField("Ruxsat", max_length=10, choices=TokenScope.choices, default=TokenScope.READ)
    # the owner's token_version at issue: blocking the user or a password change kills the token, like JWTs
    token_version = models.PositiveIntegerField()
    expires_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "MCP token"
        verbose_name_plural = "MCP tokenlar"

    def __str__(self) -> str:
        return f"{self.prefix}… ({self.name})"

    @property
    def is_expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= timezone.now()

    @property
    def can_write(self) -> bool:
        return self.scope == TokenScope.WRITE
