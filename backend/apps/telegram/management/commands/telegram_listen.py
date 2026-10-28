import asyncio

from django.core.management.base import BaseCommand

from apps.telegram.listener import Runner


class Command(BaseCommand):
    help = ("Keeps the connected Telegram accounts online: new messages reach their owners live; with REDIS_URL "
            "the web app's Telegram calls go through it too. Run it as a service (README).")

    def handle(self, *args, **options):
        try:
            asyncio.run(Runner().run())
        except KeyboardInterrupt:
            self.stdout.write("telegram_listen: stopped")
