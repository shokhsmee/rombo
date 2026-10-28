import time

from django.core.management.base import BaseCommand

from apps.crm.services.worker import run_once


class Command(BaseCommand):
    help = ("CRM background work (uzbridge's Celery beat): stale calls, Drive recordings, task reminders, "
            "amoCRM tokens, history pull. Runs forever; --once for cron or a check.")

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--every", type=int, default=60, help="seconds between passes")

    def handle(self, *args, once=False, every=60, **options):
        while True:
            out = run_once()
            self.stdout.write(f"crm_worker: {out}")
            if once:
                return
            time.sleep(every)
