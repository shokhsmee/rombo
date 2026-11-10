"""Run the Servis bots by long polling (dev, or a server without HTTPS), or register them.

    manage.py service_bots                 # poll both bots (those with a token) until stopped
    manage.py service_bots --setup         # commands + Mini App menu button, then exit
    manage.py service_bots --set-webhook   # setup + webhook to PUBLIC_BASE_URL (production), then exit
"""

import logging
import threading
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from apps.maintenance import bot
from apps.maintenance.models import BotKind

log = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Servis bots: long polling, or --setup / --set-webhook"

    def add_arguments(self, parser):
        parser.add_argument("--setup", action="store_true")
        parser.add_argument("--set-webhook", action="store_true")

    def handle(self, *args, setup=False, set_webhook=False, **opts):
        kinds = [k for k in BotKind.values if bot.enabled(k)]
        if not kinds:
            raise CommandError("SERVICE_CLIENT_BOT_TOKEN / SERVICE_MASTER_BOT_TOKEN are empty")
        for kind in kinds:
            if not setup and not set_webhook:
                # polling and a webhook exclude each other
                bot.api(kind, "deleteWebhook", drop_pending_updates=False)
            try:
                done = bot.setup(kind, webhook=set_webhook)
            except bot.BotError as e:
                raise CommandError(f"{kind}: {e}") from e
            me = bot.api(kind, "getMe")
            self.stdout.write(self.style.SUCCESS(f"{kind}: @{me.get('username')} — {', '.join(done)}"))
        if not bot.webapp_ready():
            self.stdout.write(self.style.WARNING(
                "Mini App URL is not https — set PUBLIC_BASE_URL (or SERVICE_WEBAPP_URL for a tunnel); "
                "until then the bots work without the app button."))
        if setup or set_webhook:
            return
        threads = [threading.Thread(target=self._poll, args=(k,), daemon=True, name=f"bot-{k}")
                   for k in kinds]
        for t in threads:
            t.start()
        self.stdout.write(f"polling {', '.join(kinds)} — Ctrl+C to stop")
        try:
            while any(t.is_alive() for t in threads):
                time.sleep(1)
        except KeyboardInterrupt:
            self.stdout.write("stopped")

    def _poll(self, kind: str) -> None:
        offset = None
        while True:
            try:
                updates = bot.api(kind, "getUpdates", offset=offset, timeout=30,
                                  allowed_updates=["message", "callback_query"])
            except bot.BotError as e:
                log.warning("%s getUpdates: %s", kind, e)
                time.sleep(5)
                continue
            for u in updates or []:
                offset = u["update_id"] + 1
                close_old_connections()
                bot.handle_update(kind, u)
