# Design: add-service-maintenance

## Bot transport: plain Bot API over httpx
Options: aiogram / python-telegram-bot, Telethon (already used for employee accounts), or raw HTTPS calls.
Chosen: raw calls through one `bot.api()` function on httpx (already a dependency), synchronous like the rest of
the services. The bots only send messages, answer buttons and read contacts; a framework would add an async
runtime and a second way of doing things. Telethon is MTProto for user accounts and is the wrong tool for bots.
Tests fake the transport the same way provider calls are faked (`apps.crm.providers.http.TRANSPORT`).

## Webhook and polling, same handler
`handle_update(kind, update)` is the only entry. The webhook view and the polling command both call it, so the
behaviour is identical in dev (no HTTPS) and production. The webhook checks
`X-Telegram-Bot-Api-Secret-Token`.

## Mini App auth: Telegram initData, no JWT
The Mini App sends `Authorization: tma <initData>`. The server checks the HMAC with the bot's token
(`secret = HMAC_SHA256("WebAppData", token)`), refuses data older than 24 h, and finds the `BotUser` by Telegram
id. A client sees only its own requests; a master only jobs assigned to it. ERP users and roles are untouched:
masters and clients are not ERP users. Rejected: issuing JWTs to bot users (a second login system to keep).

## One BotUser table for both bots
`BotUser(bot, tg_id)` unique, with nullable `client` / `master`. Same person can use both bots.

## Notifications after commit
Services call `notify.*` inside `transaction.on_commit`, then a Celery task sends (inline without Redis). A
failed send never breaks the business write.

## Master identity
A master is linked only when their shared phone matches an active Usta — the bot never creates masters, so a
stranger can't see client addresses. Clients are created on first contact (they are leads anyway).
