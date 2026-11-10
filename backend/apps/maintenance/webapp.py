"""Mini App authentication: the Telegram `initData` string, signed with the bot's token (design.md).

The Mini App sends `Authorization: tma <initData>`. With SERVICE_MINIAPP_DEV and DEBUG both on, a browser
outside Telegram may send `Authorization: dev <telegram id>` to preview the app locally.
"""

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, PermissionDenied

from apps.maintenance import bot
from apps.maintenance.models import BotKind, BotUser

MAX_AGE = 24 * 3600


def validate_init_data(init_data: str, bot_token: str, *, now: float | None = None) -> dict:
    """The Telegram user dict when the signature is right and fresh; AuthenticationFailed otherwise."""
    pairs = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=False))
    received = pairs.pop("hash", "")
    if not received or not bot_token:
        raise AuthenticationFailed("Telegram ma'lumoti yo'q")
    check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        raise AuthenticationFailed("Telegram imzosi noto'g'ri")
    try:
        auth_date = int(pairs.get("auth_date", "0"))
        user = json.loads(pairs.get("user", "{}"))
    except (ValueError, json.JSONDecodeError) as e:
        raise AuthenticationFailed("Telegram ma'lumoti buzilgan") from e
    if (now or time.time()) - auth_date > MAX_AGE:
        raise AuthenticationFailed("Sessiya eskirgan — ilovani qayta oching")
    if not user.get("id"):
        raise AuthenticationFailed("Telegram foydalanuvchisi yo'q")
    return user


def bot_user_from_request(request, kind: str) -> BotUser:
    header = request.headers.get("Authorization", "")
    scheme, _, value = header.partition(" ")
    if scheme == "dev" and settings.DEBUG and settings.SERVICE_MINIAPP_DEV and value.strip().isdigit():
        user = {"id": int(value)}
    elif scheme == "tma" and value:
        user = validate_init_data(value, bot.token(kind))
    else:
        raise NotAuthenticated("Ilovani Telegram ichida oching")

    bu = BotUser.objects.select_related("client", "master").filter(bot=kind, tg_id=user["id"]).first()
    if bu is None:
        if len(user) == 1:  # dev login for someone who never wrote to the bot
            raise PermissionDenied("Bu Telegram ID botda yo'q")
        bu = BotUser.objects.create(bot=kind, tg_id=user["id"], chat_id=user["id"],
                                    username=user.get("username", "")[:64],
                                    first_name=user.get("first_name", "")[:128],
                                    last_name=user.get("last_name", "")[:128])
    linked = bu.client_id if kind == BotKind.CLIENT else (bu.master_id and bu.master.is_active)
    if not linked:
        exc = PermissionDenied("Avval botda telefon raqamingizni yuboring")
        exc.default_code = "not_linked"
        raise exc
    return bu
