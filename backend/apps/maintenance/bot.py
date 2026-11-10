"""The two Servis bots over the Telegram Bot API (plain HTTPS, see design.md).

`handle_update(kind, update)` is the only entry: the webhook view and `manage.py service_bots` (long polling)
both call it. Requests go through apps.crm.providers.http so tests can fake the network.
"""

import logging

from django.conf import settings
from django.db import transaction

from apps.clients.services import client_create
from apps.core.exceptions import DomainError
from apps.crm import phones, selectors
from apps.crm.providers import http
from apps.maintenance.models import BotKind, BotUser, ServiceRequest

log = logging.getLogger(__name__)
API = "https://api.telegram.org"


class BotError(Exception):
    pass


def token(kind: str) -> str:
    return {BotKind.CLIENT: settings.SERVICE_CLIENT_BOT_TOKEN,
            BotKind.MASTER: settings.SERVICE_MASTER_BOT_TOKEN}.get(kind, "")


def enabled(kind: str) -> bool:
    return bool(token(kind))


def api(kind: str, method: str, **payload):
    """One Bot API call. Raises BotError with Telegram's description when it says no."""
    t = token(kind)
    if not t:
        raise BotError(f"{kind} bot token is not set")
    try:
        r = http.request("POST", f"{API}/bot{t}/{method}", json=payload,
                         timeout=payload.get("timeout", 0) + 20)
    except Exception as e:  # network
        raise BotError(f"{method}: {e}") from e
    data = r.json() if r.content else {}
    if not data.get("ok"):
        raise BotError(f"{method}: {data.get('error_code')} {data.get('description', r.text[:200])}")
    return data.get("result")


def webapp_url(kind: str, path: str = "") -> str:
    """Mini App address. Telegram requires HTTPS: PUBLIC_BASE_URL (or SERVICE_WEBAPP_URL for a dev tunnel)."""
    base = (settings.SERVICE_WEBAPP_URL or f"{settings.PUBLIC_BASE_URL}/app").rstrip("/")
    return f"{base}/{kind}/{path}".rstrip("/")


def webapp_ready() -> bool:
    return webapp_url("x").startswith("https://")


def open_button(kind: str, text: str = "📱 Ilovani ochish", path: str = "") -> dict | None:
    if not webapp_ready():
        return None
    return {"text": text, "web_app": {"url": webapp_url(kind, path)}}


def send(kind: str, chat_id: int, text: str, *, buttons: list[list[dict]] | None = None,
         reply_markup: dict | None = None) -> None:
    """Send a message; a user who blocked the bot is marked and skipped next time."""
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    rows = [[b for b in row if b] for row in (buttons or [])]
    rows = [row for row in rows if row]
    if rows:
        payload["reply_markup"] = {"inline_keyboard": rows}
    elif reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        api(kind, "sendMessage", **payload)
    except BotError as e:
        if " 403 " in f" {e} ":
            BotUser.objects.filter(bot=kind, chat_id=chat_id).update(blocked=True)
        log.warning("service bot %s: %s", kind, e)


# ------------------------------------------------------------------ setup


COMMANDS = {
    BotKind.CLIENT: [{"command": "start", "description": "Boshlash"},
                     {"command": "app", "description": "Arizalarim / yangi ariza"}],
    BotKind.MASTER: [{"command": "start", "description": "Boshlash"},
                     {"command": "app", "description": "Ishlarim"}],
}


def setup(kind: str, *, webhook: bool = False) -> list[str]:
    """Commands, the menu button (opens the Mini App) and, optionally, the webhook. Returns what was done."""
    done = []
    api(kind, "setMyCommands", commands=COMMANDS[kind])
    done.append("commands")
    if webapp_ready():
        api(kind, "setChatMenuButton", menu_button={
            "type": "web_app", "text": "Ilova", "web_app": {"url": webapp_url(kind)}})
        done.append(f"menu → {webapp_url(kind)}")
    if webhook:
        url = f"{settings.PUBLIC_BASE_URL}/api/v1/maintenance/bot/{kind}/webhook/"
        if not url.startswith("https://"):
            raise BotError("webhook needs PUBLIC_BASE_URL with https://")
        api(kind, "setWebhook", url=url, secret_token=settings.SERVICE_WEBHOOK_SECRET,
            allowed_updates=["message", "callback_query"], drop_pending_updates=False)
        done.append(f"webhook → {url}")
    return done


# ------------------------------------------------------------------ updates

ASK_PHONE = {
    BotKind.CLIENT: ("Assalomu alaykum! <b>Rombo</b> servis botiga xush kelibsiz.\n\n"
                     "Deraza yoki eshikda muammo bo'lsa — shu yerdan ariza qoldiring, usta keladi.\n"
                     "Boshlash uchun telefon raqamingizni yuboring 👇"),
    BotKind.MASTER: ("Assalomu alaykum! Bu <b>Rombo ustalari</b> boti.\n\n"
                     "Telefon raqamingizni yuboring — ofisdagi ro'yxat bilan tekshiramiz 👇"),
}
PHONE_KEYBOARD = {"keyboard": [[{"text": "📞 Raqamni yuborish", "request_contact": True}]],
                  "resize_keyboard": True, "one_time_keyboard": True}


def _upsert_user(kind: str, frm: dict, chat_id: int) -> BotUser:
    bu, _ = BotUser.objects.update_or_create(bot=kind, tg_id=frm["id"], defaults={
        "chat_id": chat_id, "username": frm.get("username", "")[:64],
        "first_name": frm.get("first_name", "")[:128], "last_name": frm.get("last_name", "")[:128],
        "blocked": False})
    return bu


def is_linked(bu: BotUser) -> bool:
    return bool(bu.client_id if bu.bot == BotKind.CLIENT else bu.master_id)


def _welcome(bu: BotUser) -> None:
    if bu.bot == BotKind.CLIENT:
        text = (f"✅ Tayyor, {bu.client.name}!\n\n"
                "Pastdagi tugma orqali ariza qoldiring va uning holatini kuzating. "
                "Usta biriktirilganda va ish bajarilganda shu yerga xabar keladi.")
        btn = open_button(bu.bot, "🛠 Ariza qoldirish", "new")
    else:
        text = (f"✅ Xush kelibsiz, usta {bu.master.name}!\n\n"
                "Yangi ishlar shu yerga keladi — qabul qiling yoki rad eting. Barcha ishlaringiz ilovada.")
        btn = open_button(bu.bot, "📋 Ishlarim")
    # remove the phone keyboard first, then the inline Mini App button
    send(bu.bot, bu.chat_id, text, reply_markup={"remove_keyboard": True})
    if btn:
        send(bu.bot, bu.chat_id, "👇", buttons=[[btn]])


def _link_phone(bu: BotUser, contact: dict) -> None:
    if contact.get("user_id") != bu.tg_id:
        send(bu.bot, bu.chat_id, "Iltimos, <b>o'zingizning</b> raqamingizni tugma orqali yuboring.",
             reply_markup=PHONE_KEYBOARD)
        return
    phone = phones.normalize(contact.get("phone_number", ""))
    bu.phone = phone
    if bu.bot == BotKind.MASTER:
        from apps.maintenance.services import master_by_phone

        master = master_by_phone(phone)
        if master is None:
            bu.save(update_fields=["phone", "updated_at"])
            send(bu.bot, bu.chat_id, f"❌ {phones.pretty(phone)} raqami ustalar ro'yxatida yo'q.\n"
                                      "Ofis menejeriga murojaat qiling, so'ng /start bosing.",
                 reply_markup={"remove_keyboard": True})
            return
        bu.master = master
    else:
        client = selectors.client_by_phone(phone)
        if client is None:
            name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or bu.full_name
            client = client_create(actor=None, name=name[:255] if len(name) >= 2 else f"Mijoz {phone}",
                                   phone=phone, source="Telegram servis bot")
        bu.client = client
    bu.save()
    _welcome(bu)


def _on_message(kind: str, msg: dict) -> None:
    frm = msg.get("from") or {}
    if not frm or msg.get("chat", {}).get("type") != "private":
        return
    bu = _upsert_user(kind, frm, msg["chat"]["id"])
    if "contact" in msg:
        _link_phone(bu, msg["contact"])
        return
    if not is_linked(bu):
        send(kind, bu.chat_id, ASK_PHONE[kind], reply_markup=PHONE_KEYBOARD)
        return
    text = (msg.get("text") or "").strip()
    if text.startswith("/start"):
        _welcome(bu)
        return
    btn = open_button(kind, "📱 Ilovani ochish")
    hint = "Arizalar — ilovada 👇" if kind == BotKind.CLIENT else "Ishlaringiz — ilovada 👇"
    if btn is None:
        hint = "Ilova hali sozlanmagan. Ofisga qo'ng'iroq qiling."
    send(kind, bu.chat_id, hint, buttons=[[btn]] if btn else None)


def _answer(kind: str, cq: dict, text: str, *, alert: bool = False, drop_buttons: bool = True) -> None:
    try:
        api(kind, "answerCallbackQuery", callback_query_id=cq["id"], text=text[:190], show_alert=alert)
        msg = cq.get("message")
        if drop_buttons and msg:
            api(kind, "editMessageReplyMarkup", chat_id=msg["chat"]["id"], message_id=msg["message_id"],
                reply_markup={"inline_keyboard": []})
    except BotError as e:
        log.info("service bot %s: %s", kind, e)


def _on_callback(kind: str, cq: dict) -> None:
    from apps.maintenance import services

    bu = BotUser.objects.filter(bot=kind, tg_id=cq["from"]["id"]).select_related("client", "master").first()
    if bu is None or not is_linked(bu):
        _answer(kind, cq, "Avval /start bosing", alert=True, drop_buttons=False)
        return
    action, _, rest = (cq.get("data") or "").partition(":")
    rid, _, arg = rest.partition(":")
    req = ServiceRequest.objects.filter(pk=int(rid) if rid.isdigit() else 0).first()
    if req is None:
        _answer(kind, cq, "Ariza topilmadi", alert=True)
        return
    try:
        if kind == BotKind.MASTER and action == "acc":
            services.master_accept(req, master=bu.master)
            _answer(kind, cq, "✅ Qabul qilindi")
        elif kind == BotKind.MASTER and action == "dec":
            services.master_decline(req, master=bu.master)
            _answer(kind, cq, "Rad etildi. Ofisga xabar berildi.")
        elif kind == BotKind.CLIENT and action == "rate" and arg.isdigit():
            services.client_rate(req, client=bu.client, rating=int(arg))
            _answer(kind, cq, "Rahmat! Bahoyingiz qabul qilindi 🙏")
        else:
            _answer(kind, cq, "Noma'lum amal", drop_buttons=False)
    except DomainError as e:
        _answer(kind, cq, e.message, alert=True)


def handle_update(kind: str, update: dict) -> None:
    """Never raises: one bad update must not stop the poller or make Telegram retry the webhook forever."""
    try:
        with transaction.atomic():
            if "message" in update:
                _on_message(kind, update["message"])
            elif "callback_query" in update:
                _on_callback(kind, update["callback_query"])
    except Exception:
        log.exception("service bot %s: update %s failed", kind, update.get("update_id"))
