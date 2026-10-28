"""`manage.py telegram_listen`: one live Telegram connection per connected account (uzbridge tgchat/listener.py).

It receives new / edited / deleted / read messages and reactions and hands them to services (pushed to the
owner's browser over the live socket — set REDIS_URL so this process can publish). With Redis it also serves
the web app's calls for its accounts (client.call), so a session never has two live connections.
"""

import asyncio
import json
import logging

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db import close_old_connections

from apps.telegram import client as tg
from apps.telegram import ops, services

log = logging.getLogger(__name__)
RELOAD = 20  # seconds between re-reading the account list
DEAD = ("AuthKeyUnregisteredError", "SessionRevokedError", "UserDeactivatedError", "AuthKeyDuplicatedError")


def db(fn):
    def run(*a, **kw):
        close_old_connections()
        return fn(*a, **kw)

    return sync_to_async(run, thread_sensitive=True)


class Worker:
    def __init__(self, account):
        self.account = account
        self.session = account.session
        self.client = None
        self.task: asyncio.Task | None = None

    async def run(self):
        from telethon import events
        from telethon.tl import types as tl

        acc = self.account
        self.client = tg.make_client(acc.session, *acc.credentials())
        try:
            await self.client.connect()
            if not await self.client.is_user_authorized():
                await db(services.session_gone)(acc)
                return
            c = self.client
            c.add_event_handler(self.on_new, events.NewMessage())
            c.add_event_handler(self.on_read_out, events.MessageRead(inbox=False))
            c.add_event_handler(self.on_read_in, events.MessageRead(inbox=True))
            c.add_event_handler(self.on_edit, events.MessageEdited())
            c.add_event_handler(self.on_delete, events.MessageDeleted())
            c.add_event_handler(self.on_reactions, events.Raw(tl.UpdateMessageReactions))
            extra = [asyncio.create_task(self.rpc())] if settings.REDIS_URL else []
            log.info("telegram: listening %s", acc)
            try:
                await c.run_until_disconnected()
            finally:
                for t in extra:
                    t.cancel()
        except Exception as e:
            if type(e).__name__ in DEAD:
                await db(services.session_gone)(acc)
            else:
                log.exception("telegram: %s stopped", acc)
        finally:
            if self.client is not None:
                await self.client.disconnect()

    async def stop(self):
        if self.client is not None:
            await self.client.disconnect()
        if self.task:
            self.task.cancel()

    # ---- events
    async def on_new(self, event):
        chat = await event.get_chat()
        if ops.skip(chat):
            return
        sender = await event.get_sender()
        await db(services.ingest)(self.account, ops.peer_of(chat), ops.message_out(event.message, sender))

    async def on_read_out(self, event):
        await db(services.on_read_out)(self.account, event.chat_id, event.max_id)

    async def on_read_in(self, event):
        await db(services.on_read_in)(self.account, event.chat_id)

    async def on_edit(self, event):
        await db(services.on_edit)(self.account, event.chat_id, ops.message_out(event.message))

    async def on_delete(self, event):
        await db(services.on_delete)(self.account, event.chat_id, list(event.deleted_ids or []))

    async def on_reactions(self, update):
        from telethon import utils as tl_utils

        await db(services.on_edit)(self.account, tl_utils.get_peer_id(update.peer),
                                   {"tg_id": update.msg_id, "reactions": ops.reactions_of(update)})

    # ---- the web app's calls, over Redis
    async def rpc(self):
        import redis.asyncio as aioredis

        r = aioredis.Redis.from_url(settings.REDIS_URL)
        alive, queue = tg.ALIVE.format(self.account.pk), tg.QUEUE.format(self.account.pk)
        try:
            while True:
                await r.set(alive, 1, ex=tg.HEARTBEAT)
                got = await r.blpop([queue], timeout=10)
                if got is None:
                    continue
                job = json.loads(got[1])
                try:
                    out = {"result": await tg.run_op(self.client, job["op"], job.get("args") or {})}
                except tg.TgError as e:
                    out = {"error": str(e)}
                reply = tg.REPLY.format(job["rid"])
                await r.rpush(reply, json.dumps(out, default=str))
                await r.expire(reply, 120)
        finally:
            await r.delete(alive)
            await r.aclose()


class Runner:
    """Keeps one Worker per listening account; picks up new sign-ins and drops disconnected ones."""

    def __init__(self):
        self.workers: dict[int, Worker] = {}

    async def run(self):
        while True:
            accounts = {a.pk: a for a in await db(services.listening)()}
            for pk, w in list(self.workers.items()):
                acc = accounts.get(pk)
                if acc is None or w.task is None or w.task.done() or acc.session != w.session:
                    await w.stop()
                    del self.workers[pk]
            for pk, acc in accounts.items():
                if pk not in self.workers:
                    w = Worker(acc)
                    w.task = asyncio.create_task(w.run())
                    self.workers[pk] = w
            await asyncio.sleep(RELOAD)
