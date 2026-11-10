"""Who hears about what. Every function only queues messages after the transaction commits; the Celery task
(tasks.send_message) sends them — inline without Redis. A failed send never breaks the business write."""

from django.db import transaction
from django.utils import timezone

from apps.crm import phones
from apps.maintenance.models import BotKind, BotUser, RequestKind, RequestStatus, ServiceRequest

S = RequestStatus


def _queue(kind: str, chat_ids, text: str, buttons=None) -> None:
    chat_ids = list(chat_ids)
    if not chat_ids:
        return

    def go():
        from apps.maintenance import bot
        from apps.maintenance.tasks import send_message

        if not bot.enabled(kind):
            return
        for chat_id in chat_ids:
            send_message.delay(kind, chat_id, text, buttons)

    transaction.on_commit(go)


def _client_chats(req: ServiceRequest):
    return BotUser.objects.filter(bot=BotKind.CLIENT, client_id=req.client_id, blocked=False) \
        .values_list("chat_id", flat=True)


def _master_chats(master_id: int | None):
    if not master_id:
        return []
    return BotUser.objects.filter(bot=BotKind.MASTER, master_id=master_id, blocked=False) \
        .values_list("chat_id", flat=True)


def _when(req: ServiceRequest) -> str:
    if req.scheduled_at:
        return timezone.localtime(req.scheduled_at).strftime("%d.%m.%Y %H:%M")
    if req.preferred_date:
        return f"{req.preferred_date:%d.%m.%Y} (mijoz xohishi)"
    return "kelishiladi"


def _btn(kind: str, text: str, path: str):
    from apps.maintenance.bot import open_button

    return open_button(kind, text, path)


def _job_text(req: ServiceRequest, title: str) -> str:
    lines = [f"{title}\n", f"<b>{req.code}</b> · {RequestKind(req.kind).label}",
             f"👤 {req.client.name}  📞 {phones.pretty(req.phone) or '—'}",
             f"📍 {req.address or '—'}", f"🕒 {_when(req)}"]
    if req.is_warranty:
        lines.append("🛡 Kafolat")
    lines.append(f"\n{req.description[:600]}")
    return "\n".join(lines)


def request_created(req: ServiceRequest) -> None:
    if req.source == "bot":
        _queue(BotKind.CLIENT, _client_chats(req),
               f"📝 Arizangiz qabul qilindi: <b>{req.code}</b>\nTez orada usta biriktiramiz.",
               [[_btn(BotKind.CLIENT, "Arizani ko'rish", f"r/{req.pk}")]])


def assigned(req: ServiceRequest) -> None:
    m = req.master
    _queue(BotKind.MASTER, _master_chats(m.pk), _job_text(req, "🛠 <b>Yangi ish</b>"), [
        [{"text": "✅ Qabul qilish", "callback_data": f"acc:{req.pk}"},
         {"text": "❌ Rad etish", "callback_data": f"dec:{req.pk}"}],
        [_btn(BotKind.MASTER, "📋 Batafsil", f"j/{req.pk}")],
    ])
    _queue(BotKind.CLIENT, _client_chats(req),
           f"👷 <b>{req.code}</b>: usta biriktirildi — {m.name}, {phones.pretty(m.phone)}\n🕒 {_when(req)}",
           [[_btn(BotKind.CLIENT, "Arizani ko'rish", f"r/{req.pk}")]])


def master_removed(req: ServiceRequest, master) -> None:
    _queue(BotKind.MASTER, _master_chats(master.pk),
           f"↩️ <b>{req.code}</b> endi sizda emas ({S(req.status).label.lower()}).")


def master_declined(req: ServiceRequest, master, reason: str) -> None:
    pass  # the operator sees it in the list (status back to "Yangi") and in the history


CLIENT_STATUS_TEXT = {
    S.ACCEPTED: "✅ Usta arizangizni qabul qildi.",
    S.IN_PROGRESS: "🔧 Usta ishni boshladi.",
    S.CANCELLED: "🚫 Ariza bekor qilindi.",
}


def status_changed(req: ServiceRequest, old: str) -> None:
    if req.status == S.DONE:
        _queue(BotKind.CLIENT, _client_chats(req),
               f"🎉 <b>{req.code}</b>: usta ishni tugatdi.\n\n{req.report[:500]}\n\n"
               "Ish sizga ma'qulmi? Baholang:",
               [[{"text": "⭐" * n, "callback_data": f"rate:{req.pk}:{n}"} for n in (1, 2, 3)],
                [{"text": "⭐" * n, "callback_data": f"rate:{req.pk}:{n}"} for n in (4, 5)],
                [_btn(BotKind.CLIENT, "Hal bo'lmadi / izoh", f"r/{req.pk}")]])
    elif req.status in CLIENT_STATUS_TEXT:
        _queue(BotKind.CLIENT, _client_chats(req), f"<b>{req.code}</b>: {CLIENT_STATUS_TEXT[req.status]}")


def rated(req: ServiceRequest) -> None:
    _queue(BotKind.MASTER, _master_chats(req.master_id),
           f"⭐ <b>{req.code}</b>: mijoz bahosi {req.rating}/5"
           + (f"\n«{req.feedback[:300]}»" if req.feedback else ""))


def reopened(req: ServiceRequest, comment: str) -> None:
    _queue(BotKind.MASTER, _master_chats(req.master_id),
           f"⚠️ <b>{req.code}</b>: mijoz «hal bo'lmadi» dedi:\n{comment[:500]}",
           [[_btn(BotKind.MASTER, "📋 Batafsil", f"j/{req.pk}")]])
