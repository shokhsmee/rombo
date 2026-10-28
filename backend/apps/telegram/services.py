"""Telegram writes (uzbridge tgchat/services.py). Only metadata is stored; message text goes live to the owner.

A first message in a private chat makes the sender a Mijoz (auto_clients) and, if the account says so, a lead
(crm_leads). The text itself never goes into Rombo: the lead gets a fixed line "Telegram orqali yozdi".
"""

import base64
from datetime import datetime

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.clients.models import Client, ClientKind
from apps.clients.services import client_create
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.realtime import publish
from apps.crm import phones, selectors
from apps.telegram import client as tg
from apps.telegram.models import Account, Chat

MAX_TEXT = 4096
MAX_CAPTION = 1024
UPLOAD_BYTES = 15 * 1024 * 1024
PAGE = 50


def _err(e: Exception):
    """Telegram's message as a 400 for the person."""
    raise ValidationFailed(str(e)) from e


# ------------------------------------------------------------------ live pushes (owner only)


def push(acc: Account, ev: str, **data) -> None:
    publish({"type": "tg", "ev": ev, **data}, [acc.owner_id])


def account_event(account: Account) -> None:
    from apps.telegram.serializers import AccountSerializer

    push(account, "account", account=AccountSerializer(account).data)


# ------------------------------------------------------------------ accounts


def account_create(*, actor, phone: str, name: str = "", api_id=None, api_hash: str = "", **flags) -> Account:
    number = phones.normalize(phone)
    if len(phones.digits(number)) < 9:
        raise ValidationFailed("Telefon raqamini to'liq kiriting", field="phone")
    if Account.objects.filter(phone=number).exists():
        raise Conflict("Bu raqam allaqachon qo'shilgan", field="phone")
    acc = Account(owner=actor, phone=number, name=(name or number)[:100], api_id=api_id or None,
                  api_hash=api_hash or "", **flags)
    if not all(acc.credentials()):
        raise ValidationFailed("Telegram API ID / API Hash kerak (my.telegram.org)", field="api_id")
    acc.stamp(actor, created=True)
    acc.save()
    return acc


def account_update(acc: Account, *, actor, **fields) -> Account:
    if "api_id" in fields and not fields["api_id"]:
        fields["api_id"], fields["api_hash"] = None, ""  # back to the install's app
    elif fields.get("api_hash") in (None, ""):
        fields.pop("api_hash", None)  # write-only: empty keeps the saved one
    for k, v in fields.items():
        setattr(acc, k, v)
    acc.stamp(actor)
    acc.save()
    return acc


def account_send_code(acc: Account, *, actor) -> Account:
    try:
        acc.code_hash, acc.login_session = tg.send_code(acc)
    except tg.TgError as e:
        _err(e)
    acc.status, acc.error = Account.Status.CODE_SENT, ""
    acc.save(update_fields=["code_hash", "login_session", "status", "error", "updated_at"])
    return acc


def account_sign_in(acc: Account, *, actor, code: str = "", password: str = "") -> bool:
    """True when signed in (the chat list is pulled at once); False when the 2FA password is needed."""
    try:
        me, session = tg.sign_in(acc, code=code, password=password)
    except tg.TgError as e:
        _err(e)
    if me is None:
        acc.login_session, acc.status = session, Account.Status.PASSWORD
        acc.save(update_fields=["login_session", "status", "updated_at"])
        return False
    acc.session, acc.login_session, acc.code_hash = session, "", ""
    acc.status, acc.error, acc.active = Account.Status.CONNECTED, "", True
    acc.tg_user_id = me.id
    acc.tg_name = tg.ops.entity_name(me)[:150]
    acc.tg_username = (getattr(me, "username", "") or "")[:64]
    if not acc.name or acc.name == acc.phone:
        acc.name = (acc.tg_name or acc.phone)[:100]
    acc.save()
    try:
        sync_dialogs(acc)
    except ValidationFailed:
        pass  # the account works; the list comes on the next sync
    account_event(acc)
    return True


def account_disconnect(acc: Account, *, actor=None) -> Account:
    if acc.session:
        try:
            tg.call(acc, "logout", timeout=20)
        except tg.TgError:
            pass  # best effort: the session may be dead already
    acc.session = acc.login_session = acc.code_hash = ""
    acc.status = Account.Status.NEW
    acc.save(update_fields=["session", "login_session", "code_hash", "status", "updated_at"])
    account_event(acc)
    return acc


def account_delete(acc: Account, *, actor) -> None:
    account_disconnect(acc)
    acc.delete()


def session_gone(acc: Account, error: str = tg.SESSION_GONE) -> None:
    """The listener found the session dead (ended from the phone)."""
    Account.objects.filter(pk=acc.pk).update(session="", status=Account.Status.ERROR, error=error[:255])
    acc.refresh_from_db()
    account_event(acc)


# ------------------------------------------------------------------ chats


def _chat_for(acc: Account, peer: dict) -> Chat:
    defaults = {k: peer.get(k) or "" for k in ("kind", "name", "username")}
    defaults["phone"] = phones.normalize(peer.get("phone"))[:20]
    defaults["access_hash"] = peer.get("access_hash")
    try:
        chat, created = Chat.objects.get_or_create(account=acc, chat_id=int(peer["chat_id"]), defaults=defaults)
    except IntegrityError:  # the listener and a sync at once
        chat, created = Chat.objects.get(account=acc, chat_id=int(peer["chat_id"])), False
    if not created:
        changed = {k: v for k, v in defaults.items() if v not in ("", None) and getattr(chat, k) != v}
        if not chat.active:
            changed["active"] = True
        if changed:
            Chat.objects.filter(pk=chat.pk).update(**changed)
            for k, v in changed.items():
                setattr(chat, k, v)
    return chat


def sync_dialogs(acc: Account, limit: int = 200, photos: bool = True) -> list[tuple[Chat, dict | None]]:
    """The account's chats from Telegram: metadata stored, the last message only returned (a preview)."""
    have = list(acc.chats.exclude(photo=None).values_list("chat_id", flat=True))
    try:
        rows = tg.call(acc, "dialogs", limit=limit, have_photo=have, photos=photos) or []
    except tg.TgError as e:
        _err(e)
    out = []
    for row in rows:
        chat = _chat_for(acc, row)
        last = row.get("last")
        upd = {"unread": int(row.get("unread") or 0), "last_read_out": int(row.get("read_outbox_max_id") or 0)}
        if last:
            upd.update(last_at=datetime.fromisoformat(last["date"]), last_out=bool(last["out"]))
        if row.get("photo"):
            upd.update(photo=base64.b64decode(row["photo"]), photo_at=timezone.now())
        Chat.objects.filter(pk=chat.pk).update(**upd)
        for k, v in upd.items():
            setattr(chat, k, v)
        out.append((chat, last))
    Account.objects.filter(pk=acc.pk).update(last_sync=timezone.now())
    return out


def _telegram_source():
    from apps.references.models import RefItem, RefKind

    return (RefItem.objects.filter(kind=RefKind.SALES_CHANNEL, name__iexact="Telegram").first()
            or RefItem.objects.filter(kind=RefKind.SALES_CHANNEL, name__icontains="telegram").first())


@transaction.atomic
def first_contact(chat: Chat, acc: Account) -> None:
    """A private chat's sender → a Mijoz (by number, else a new one if auto_clients) → a lead (crm_leads)."""
    from apps.chatter.services import event
    from apps.crm.services.routing import new_lead

    if chat.client_id is None:
        client = selectors.client_by_phone(chat.phone) if chat.phone else None
        if client is None and acc.auto_clients:
            client = client_create(actor=None, kind=ClientKind.INDIVIDUAL, name=(chat.name or chat.phone or "Telegram")[:255],
                                   phone=phones.pretty(chat.phone), source="Telegram")
            event(client, "Telegram orqali yozdi")
        if client is not None:
            chat.client = client
            Chat.objects.filter(pk=chat.pk).update(client=client)
    if acc.crm_leads and chat.lead_id is None:
        lead = selectors.open_lead_by_phone(chat.phone) if chat.phone else None
        if lead is None and chat.client_id:
            from apps.crm.models import Lead

            lead = Lead.objects.filter(client_id=chat.client_id, status="open").order_by("-updated_at").first()
        if lead is None:
            manager = getattr(acc.owner, "employee", None)
            lead = new_lead(title=chat.name or phones.pretty(chat.phone) or "Telegram", phone=chat.phone,
                            name=chat.name, client=chat.client, manager=manager, source=_telegram_source(),
                            note="Telegram orqali yozdi")
        chat.lead = lead
        Chat.objects.filter(pk=chat.pk).update(lead=lead)


def ingest(acc: Account, peer: dict, message: dict) -> Chat:
    """One new message from the listener. Nothing of its text is stored; it goes to the owner's browser."""
    from apps.telegram.serializers import ChatSerializer

    chat = _chat_for(acc, peer)
    upd = {"last_at": datetime.fromisoformat(message["date"]), "last_out": bool(message["out"])}
    if not message["out"]:
        upd["unread"] = F("unread") + 1
    Chat.objects.filter(pk=chat.pk).update(**upd)
    chat.refresh_from_db()
    if not message["out"] and chat.kind == Chat.Kind.PRIVATE:
        first_contact(chat, acc)
    push(acc, "message", message=message, chat=ChatSerializer(chat).data)
    return chat


def make_lead(chat: Chat, *, actor) -> Chat:
    from apps.crm.services.routing import new_lead

    if chat.lead_id is None:
        if chat.client_id is None and chat.kind == Chat.Kind.PRIVATE:
            new_client(chat, actor=actor)
        lead = selectors.open_lead_by_phone(chat.phone) if chat.phone else None
        chat.lead = lead or new_lead(title=chat.name or "Telegram", phone=chat.phone, name=chat.name,
                                     client=chat.client, manager=getattr(actor, "employee", None),
                                     source=_telegram_source(), note="Telegram chatidan", actor=actor)
        chat.save(update_fields=["lead"])
    return chat


def link_client(chat: Chat, *, actor, client: Client | None) -> Chat:
    chat.client = client
    chat.save(update_fields=["client"])
    return chat


def new_client(chat: Chat, *, actor) -> Chat:
    if chat.client_id is None:
        chat.client = selectors.client_by_phone(chat.phone) if chat.phone else None
        if chat.client is None:
            chat.client = client_create(actor=actor, kind=ClientKind.INDIVIDUAL,
                                        name=(chat.name or chat.phone or "Telegram")[:255],
                                        phone=phones.pretty(chat.phone), source="Telegram")
        chat.save(update_fields=["client"])
    return chat


def _call(chat: Chat, op: str, **args):
    try:
        return tg.call(chat.account, op, chat_id=chat.chat_id, access_hash=chat.access_hash, **args)
    except tg.TgError as e:
        _err(e)


def chat_open(chat: Chat) -> dict:
    msgs = _call(chat, "history", limit=PAGE) or []
    chat_read(chat)
    return {"messages": list(reversed(msgs)), "has_more": len(msgs) == PAGE}


def chat_older(chat: Chat, before_tg: int) -> dict:
    msgs = _call(chat, "history", limit=PAGE, offset_id=before_tg) or []
    return {"messages": list(reversed(msgs)), "has_more": len(msgs) == PAGE}


def chat_read(chat: Chat) -> None:
    Chat.objects.filter(pk=chat.pk).update(unread=0)
    if tg.listener_alive(chat.account_id):  # a read receipt needs no extra connection only via the listener
        try:
            tg.call(chat.account, "read", chat_id=chat.chat_id, access_hash=chat.access_hash, timeout=20)
        except tg.TgError:
            pass
    push(chat.account, "unread", chat_id=chat.pk, unread=0)


def _sent(chat: Chat, msg: dict) -> dict:
    from apps.telegram.serializers import ChatSerializer

    Chat.objects.filter(pk=chat.pk).update(last_at=datetime.fromisoformat(msg["date"]), last_out=True)
    chat.refresh_from_db()
    push(chat.account, "message", message=msg, chat=ChatSerializer(chat).data)  # the owner's other tabs
    return msg


def send_text(chat: Chat, *, actor, text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ValidationFailed("Xabar bo'sh", field="text")
    return _sent(chat, _call(chat, "send", text=text[:MAX_TEXT]))


def send_file(chat: Chat, *, actor, upload, caption: str = "") -> dict:
    if upload.size > UPLOAD_BYTES:
        raise ValidationFailed("Fayl 15 MB dan katta", field="file")
    data = base64.b64encode(upload.read()).decode()
    return _sent(chat, tg.call(chat.account, "send_file", timeout=180, chat_id=chat.chat_id,
                               access_hash=chat.access_hash, name=upload.name, data=data,
                               caption=(caption or "")[:MAX_CAPTION]))


def edit_message(chat: Chat, *, actor, tg_id: int, text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ValidationFailed("Xabar bo'sh", field="text")
    _call(chat, "edit", tg_id=tg_id, text=text[:MAX_TEXT])
    msg = {"tg_id": tg_id, "chat_id": chat.pk, "text": text, "edited": True}
    push(chat.account, "update", message=msg)
    return msg


def delete_message(chat: Chat, *, actor, tg_id: int) -> None:
    _call(chat, "delete", tg_ids=[tg_id])
    push(chat.account, "delete", chat_id=chat.pk, tg_ids=[tg_id])


def media(chat: Chat, tg_id: int) -> dict | None:
    return _call(chat, "media", tg_id=tg_id)


def archive(chat: Chat, *, actor) -> None:
    Chat.objects.filter(pk=chat.pk).update(active=False)


# ------------------------------------------------------------------ listener events


def on_read_out(acc: Account, chat_id: int, max_id: int) -> None:
    chat = Chat.objects.filter(account=acc, chat_id=chat_id).first()
    if chat and max_id > chat.last_read_out:
        Chat.objects.filter(pk=chat.pk).update(last_read_out=max_id)
        push(acc, "read", chat_id=chat.pk, last_read_out=max_id)


def on_read_in(acc: Account, chat_id: int) -> None:
    chat = Chat.objects.filter(account=acc, chat_id=chat_id).first()
    if chat and chat.unread:
        Chat.objects.filter(pk=chat.pk).update(unread=0)
        push(acc, "unread", chat_id=chat.pk, unread=0)


def on_edit(acc: Account, chat_id: int, message: dict) -> None:
    chat = Chat.objects.filter(account=acc, chat_id=chat_id).first()
    if chat:
        push(acc, "update", message={**message, "chat_id": chat.pk})


def on_delete(acc: Account, chat_id: int | None, tg_ids: list[int]) -> None:
    chat = Chat.objects.filter(account=acc, chat_id=chat_id).first() if chat_id else None
    push(acc, "delete", chat_id=chat.pk if chat else None, tg_ids=tg_ids)


def listening() -> list[Account]:
    return list(Account.objects.filter(active=True, status=Account.Status.CONNECTED).exclude(session="")
                .select_related("owner"))
