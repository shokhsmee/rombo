"""The web app's way to Telegram: through the listener's live connection, else a short-lived one
(uzbridge tgchat/client.py).

One Telegram session must only ever have one live connection — concurrent ones make Telegram drop updates and
can end the session. So while `manage.py telegram_listen` holds an account (its heartbeat key is in Redis,
REDIS_URL) every call is queued to it and its answer awaited; without a listener (not started, no Redis, tests)
the call runs on a fresh connection here. Signing in never goes through the listener: there is no session yet.
"""

import asyncio
import json
import logging
import uuid

from django.conf import settings

from apps.telegram import ops

log = logging.getLogger(__name__)

QUEUE = "rombo:tg:rpc:{}"
REPLY = "rombo:tg:reply:{}"
ALIVE = "rombo:tg:alive:{}"
HEARTBEAT = 30  # seconds the listener's "alive" key lives; refreshed every 10 s

SESSION_GONE = "Telegram sessiyasi tugagan (telefondan o'chirilgan bo'lishi mumkin) — qayta ulang"


class TgError(Exception):
    """Something the person can act on (a wrong code, a gone chat, Telegram not answering)."""


def _redis(wait: int = 0):
    """`wait` = the longest blocking read we'll do: the socket must outlast it."""
    import redis

    return redis.Redis.from_url(settings.REDIS_URL, socket_timeout=wait + 5, socket_connect_timeout=2)


def listener_alive(account_id: int) -> bool:
    if not settings.REDIS_URL:
        return False
    try:
        return bool(_redis().exists(ALIVE.format(account_id)))
    except Exception:
        return False


def call(account, op: str, timeout: int = 90, **args):
    """Run ops.OPS[op](client, **args) for this account and return its JSON result."""
    if not account.session:
        raise TgError("Telegram akkaunt ulanmagan")
    if listener_alive(account.pk):
        r = _redis(timeout)
        rid = uuid.uuid4().hex
        r.rpush(QUEUE.format(account.pk), json.dumps({"rid": rid, "op": op, "args": args}, default=str))
        got = r.blpop([REPLY.format(rid)], timeout=timeout)
        if got is None:
            raise TgError("Telegram javob bermadi — birozdan so'ng urinib ko'ring")
        data = json.loads(got[1])
        if data.get("error"):
            raise TgError(data["error"])
        return data.get("result")
    try:
        return asyncio.run(_direct(account, op, args))
    except TgError:
        raise
    except Exception as e:  # a broken session string, no network…
        raise TgError(friendly(e)) from e


async def _direct(account, op, args):
    client = make_client(account.session, *account.credentials())
    await client.connect()
    try:
        if not await client.is_user_authorized():
            raise TgError(SESSION_GONE)
        return await run_op(client, op, args)
    finally:
        await client.disconnect()


async def run_op(client, op, args):
    fn = ops.OPS.get(op)
    if fn is None:
        raise TgError(f"unknown op {op}")
    try:
        return await fn(client, **args)
    except TgError:
        raise
    except Exception as e:  # Telegram's own errors become a message for the person
        raise TgError(friendly(e)) from e


def make_client(session: str, api_id: int, api_hash: str):
    from telethon import TelegramClient
    from telethon.sessions import StringSession

    if not api_id or not api_hash:
        raise TgError("Telegram API ID / API Hash kiritilmagan (my.telegram.org) — TELEGRAM_API_ID / TELEGRAM_API_HASH "
                      "yoki akkauntning o'zida")
    return TelegramClient(StringSession(session or None), api_id, api_hash, device_model="Rombo ERP",
                          system_version="Web", app_version="1.0", lang_code="uz", system_lang_code="uz")


def friendly(e: Exception) -> str:
    """Telethon's errors in the person's words."""
    from telethon import errors as te

    if isinstance(e, te.FloodWaitError):
        return f"Telegram cheklov qo'ydi: {e.seconds} soniyadan keyin urinib ko'ring"
    if isinstance(e, te.PhoneCodeInvalidError):
        return "Kod noto'g'ri"
    if isinstance(e, te.PhoneCodeExpiredError):
        return "Kodning muddati o'tgan — yangisini so'rang"
    if isinstance(e, te.PasswordHashInvalidError):
        return "2FA parol noto'g'ri"
    if isinstance(e, te.PhoneNumberInvalidError):
        return "Telefon raqami noto'g'ri"
    if isinstance(e, te.PhoneNumberBannedError):
        return "Bu raqam Telegramda bloklangan"
    if isinstance(e, te.ApiIdInvalidError):
        return "API ID / API Hash noto'g'ri"
    if isinstance(e, te.AuthKeyUnregisteredError | te.SessionRevokedError | te.UserDeactivatedError):
        return SESSION_GONE
    if isinstance(e, te.MessageNotModifiedError):
        return "Matn o'zgarmadi"
    if isinstance(e, te.MessageIdInvalidError):
        return "Xabar topilmadi yoki uni o'zgartirib bo'lmaydi"
    if isinstance(e, te.ChatWriteForbiddenError | te.UserIsBlockedError | te.YouBlockedUserError):
        return "Bu chatga yozib bo'lmaydi"
    if isinstance(e, ValueError):
        return "Chat topilmadi — chatlarni yangilang"
    if isinstance(e, ConnectionError | OSError | asyncio.TimeoutError):
        return "Telegramga ulanib bo'lmadi"
    log.warning("telegram error: %r", e)
    return f"Telegram: {e}"


# ------------------------------------------------------------------ signing in (phone → code → 2FA)


def send_code(account) -> tuple[str, str]:
    """→ (phone_code_hash, login session)."""
    async def go():
        client = make_client("", *account.credentials())
        await client.connect()
        try:
            sent = await client.send_code_request(account.phone)
            return sent.phone_code_hash, client.session.save()
        finally:
            await client.disconnect()

    try:
        return asyncio.run(go())
    except TgError:
        raise
    except Exception as e:
        raise TgError(friendly(e)) from e


def sign_in(account, code: str = "", password: str = ""):
    """→ (me | None, session): None = Telegram now wants the account's 2FA password."""
    from telethon.errors import SessionPasswordNeededError

    if not account.login_session:
        raise TgError("Avval kod so'rang")

    async def go():
        client = make_client(account.login_session, *account.credentials())
        await client.connect()
        try:
            if account.status == account.Status.PASSWORD:
                if not password:
                    raise TgError("2FA parolni kiriting")
                await client.sign_in(password=password)
            else:
                if not code:
                    raise TgError("Telegramdan kelgan kodni kiriting")
                try:
                    await client.sign_in(phone=account.phone, code=code, phone_code_hash=account.code_hash)
                except SessionPasswordNeededError:
                    if not password:
                        return None, client.session.save()
                    await client.sign_in(password=password)
            me = await client.get_me()
            return me, client.session.save()
        finally:
            await client.disconnect()

    try:
        return asyncio.run(go())
    except TgError:
        raise
    except Exception as e:
        raise TgError(friendly(e)) from e
