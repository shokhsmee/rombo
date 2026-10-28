"""What Rombo asks of Telegram, as coroutines over a connected Telethon client (uzbridge tgchat/ops.py).

The listener runs them on its own always-on connection (the web app asks over Redis, client.py); when the
listener is down, client.py runs them on a short-lived connection instead. Everything in and out is JSON:
ids as ints, dates as ISO strings, file bytes as base64.
"""

import base64
import io
import logging

from telethon import utils as tl_utils
from telethon.tl import types as tl

log = logging.getLogger(__name__)

MAX_MEDIA_BYTES = 50 * 1024 * 1024  # a file shown / downloaded through Rombo, up to this size


# ------------------------------------------------------------------ what Telegram gives → JSON
def entity_name(entity) -> str:
    if entity is None:
        return ""
    first = getattr(entity, "first_name", "") or ""
    last = getattr(entity, "last_name", "") or ""
    name = f"{first} {last}".strip()
    return name or getattr(entity, "title", "") or getattr(entity, "username", "") or ""


def reactions_of(obj) -> list[dict]:
    out = []
    for r in getattr(getattr(obj, "reactions", None), "results", None) or []:
        out.append({"emoji": getattr(r.reaction, "emoticon", None) or "⭐", "count": r.count})
    return out


def media_kind(message) -> str:
    if not getattr(message, "media", None):
        return ""
    if message.photo:
        return "photo"
    if message.sticker:
        return "sticker"
    if message.voice:
        return "voice"
    if message.video_note or message.video:
        return "video"
    if message.gif:
        return "gif"
    if message.audio:
        return "audio"
    if message.document:
        return "document"
    return "other"  # a location, contact, poll…


def chat_kind(entity) -> str:
    if isinstance(entity, tl.User):
        return "private"
    if isinstance(entity, tl.Channel) and not entity.megagroup:
        return "channel"
    return "group"


def peer_of(entity) -> dict:
    """Everything needed to reach this chat again from any connection (Telethon's cache is per connection)."""
    return {
        "chat_id": tl_utils.get_peer_id(entity),
        "access_hash": getattr(entity, "access_hash", None),
        "kind": chat_kind(entity),
        "name": entity_name(entity) or str(getattr(entity, "id", "")),
        "username": getattr(entity, "username", None) or "",
        "phone": getattr(entity, "phone", None) or "",
    }


def message_out(msg, sender=None) -> dict:
    sender = sender if sender is not None else getattr(msg, "sender", None)
    return {
        "tg_id": msg.id,
        "out": bool(msg.out),
        "date": msg.date.isoformat(),
        "text": msg.message or "",
        "edited": bool(msg.edit_date),
        "reactions": reactions_of(msg),
        "media": media_kind(msg),
        "sender_id": getattr(sender, "id", None),
        "sender_name": entity_name(sender),
        "sender_username": getattr(sender, "username", None) or "",
        "sender_phone": getattr(sender, "phone", None) or "",
        "file": file_meta(msg),
    }


def file_meta(msg) -> dict | None:
    """What the page needs to show a file before fetching it: name, type, size (the bytes stay in Telegram)."""
    f = getattr(msg, "file", None) if getattr(msg, "media", None) else None
    if f is None:
        return None
    mime = f.mime_type or ("image/jpeg" if getattr(msg, "photo", None) else "application/octet-stream")
    return {"name": f.name or f"telegram_{msg.id}{f.ext or ''}", "mime": mime, "size": f.size or 0}


def skip(entity) -> bool:
    """Bots and Saved Messages stay out; people, groups and channels come in (the page filters them)."""
    if entity is None:
        return True
    return isinstance(entity, tl.User) and bool(entity.bot or entity.is_self)


async def file_of(msg, limit: int) -> dict | None:
    """The message's file as base64, or None (no file, too big, or Telegram wouldn't give it)."""
    if not getattr(msg, "media", None) or not msg.file:
        return None
    if (msg.file.size or 0) > limit:
        return None
    try:
        data = await msg.download_media(file=bytes)
    except Exception:
        log.exception("telegram: media download failed")
        return None
    if not data:
        return None
    ext = msg.file.ext or ""
    return {
        "name": msg.file.name or f"telegram_{msg.id}{ext}",
        "mime": msg.file.mime_type or "application/octet-stream",
        "data": base64.b64encode(data).decode(),
    }


# ------------------------------------------------------------------ reaching a chat
def input_peer(chat_id: int, access_hash: int | None):
    """An InputPeer from what we stored, so a fresh connection needn't have met the chat before."""
    if access_hash is None:
        return int(chat_id)  # Telethon resolves it from its cache (or the retry below fills the cache)
    real, cls = tl_utils.resolve_id(int(chat_id))
    if cls is tl.PeerUser:
        return tl.InputPeerUser(real, int(access_hash))
    if cls is tl.PeerChannel:
        return tl.InputPeerChannel(real, int(access_hash))
    return tl.InputPeerChat(real)


async def _peer(client, chat_id, access_hash):
    peer = input_peer(chat_id, access_hash)
    if isinstance(peer, int):
        try:
            return await client.get_input_entity(peer)
        except ValueError:
            await client.get_dialogs(limit=None)  # a cold cache: meeting every dialog once fills it
            return await client.get_input_entity(peer)
    return peer


# ------------------------------------------------------------------ the operations (name → coroutine)
async def send(client, chat_id, access_hash=None, text=""):
    m = await client.send_message(await _peer(client, chat_id, access_hash), text)
    return message_out(m)


async def send_file(client, chat_id, access_hash=None, name="file", data="", caption=""):
    handle = io.BytesIO(base64.b64decode(data))
    handle.name = name or "file"
    m = await client.send_file(await _peer(client, chat_id, access_hash), handle, caption=caption or None)
    return message_out(m)


async def edit(client, chat_id, access_hash=None, tg_id=0, text=""):
    await client.edit_message(await _peer(client, chat_id, access_hash), int(tg_id), text)
    return True


async def delete(client, chat_id, access_hash=None, tg_ids=()):
    await client.delete_messages(await _peer(client, chat_id, access_hash), [int(i) for i in tg_ids], revoke=True)
    return True


async def read(client, chat_id, access_hash=None):
    await client.send_read_acknowledge(await _peer(client, chat_id, access_hash))
    return True


async def history(client, chat_id, access_hash=None, limit=50, offset_id=0):
    msgs = await client.get_messages(
        await _peer(client, chat_id, access_hash), limit=int(limit), offset_id=int(offset_id or 0)
    )
    return [message_out(m) for m in msgs if not isinstance(m, tl.MessageService)]


async def media(client, chat_id, access_hash=None, tg_id=0):
    msg = await client.get_messages(await _peer(client, chat_id, access_hash), ids=int(tg_id))
    if msg is None:
        return None
    if msg.file and (msg.file.size or 0) > MAX_MEDIA_BYTES:
        return {"too_big": True}
    return await file_of(msg, MAX_MEDIA_BYTES)


async def dialogs(client, limit=200, have_photo=(), photos=True):
    """The account's chats with their last message (for the list's preview — shown, never stored), and a small
    avatar for those we don't have yet."""
    have = set(have_photo or ())
    out = []
    for d in await client.get_dialogs(limit=int(limit)):
        entity = d.entity
        if skip(entity):
            continue
        row = peer_of(entity)
        row["read_outbox_max_id"] = getattr(d.dialog, "read_outbox_max_id", 0) or 0
        row["unread"] = d.unread_count or 0
        row["last"] = (
            message_out(d.message) if d.message is not None and not isinstance(d.message, tl.MessageService) else None
        )
        row["photo"] = None
        if photos and row["chat_id"] not in have and getattr(entity, "photo", None):
            try:
                data = await client.download_profile_photo(entity, file=bytes, download_big=False)
                row["photo"] = base64.b64encode(data).decode() if data else None
            except Exception:
                log.debug("telegram: no profile photo for %s", row["chat_id"])
        out.append(row)
    return out


async def logout(client):
    await client.log_out()
    return True


OPS = {
    "send": send,
    "send_file": send_file,
    "edit": edit,
    "delete": delete,
    "read": read,
    "history": history,
    "media": media,
    "dialogs": dialogs,
    "logout": logout,
}
