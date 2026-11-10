import hashlib
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import Conflict, ValidationFailed
from apps.mcp.models import McpToken, TokenScope

TOKEN_PREFIX = "rmb_"
MAX_ACTIVE_TOKENS = 20
LAST_USED_EVERY = timedelta(minutes=1)  # don't write the row on every call


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


@transaction.atomic
def token_issue(*, actor, name: str, scope: str = TokenScope.READ, expires_days: int | None = None
                ) -> tuple[McpToken, str]:
    """Returns (token, secret). The secret is not stored and can't be shown again."""
    name = (name or "").strip()
    if not name:
        raise ValidationFailed("Nomini yozing (masalan: Claude Desktop)", field="name")
    if scope not in TokenScope.values:
        raise ValidationFailed("Noto'g'ri ruxsat", field="scope")
    if expires_days is not None and not 1 <= expires_days <= 365:
        raise ValidationFailed("Muddat 1–365 kun", field="expires_days")
    if McpToken.objects.filter(user=actor, revoked_at__isnull=True).count() >= MAX_ACTIVE_TOKENS:
        raise Conflict(f"Faol tokenlar {MAX_ACTIVE_TOKENS} tadan oshmasin — keraksizlarini o'chiring")
    secret = TOKEN_PREFIX + secrets.token_urlsafe(32)
    token = McpToken.objects.create(
        user=actor, name=name[:100], prefix=secret[:8], key_hash=hash_secret(secret), scope=scope,
        token_version=actor.token_version,
        expires_at=timezone.now() + timedelta(days=expires_days) if expires_days else None,
    )
    return token, secret


def token_revoke(token: McpToken, *, actor) -> None:
    if token.user_id != actor.pk:
        raise Conflict("Faqat o'z tokeningizni o'chira olasiz")
    if token.revoked_at is None:
        token.revoked_at = timezone.now()
        token.save(update_fields=["revoked_at"])


def token_authenticate(secret: str) -> McpToken | None:
    """The live token for this secret, or None (unknown, revoked, expired, user blocked, sessions revoked)."""
    if not secret or not secret.startswith(TOKEN_PREFIX):
        return None
    token = McpToken.objects.select_related("user").filter(key_hash=hash_secret(secret)).first()
    if token is None or token.revoked_at is not None or token.is_expired:
        return None
    user = token.user
    if not user.is_active or user.token_version != token.token_version:
        return None
    now = timezone.now()
    if token.last_used_at is None or now - token.last_used_at > LAST_USED_EVERY:
        McpToken.objects.filter(pk=token.pk).update(last_used_at=now)
        token.last_used_at = now
    return token
