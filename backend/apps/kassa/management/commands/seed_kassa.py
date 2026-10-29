from django.core.management.base import BaseCommand
from django.db import transaction

from apps.kassa.seed import seed_kassa


class Command(BaseCommand):
    help = "Seed payment purposes and the two default accounts (Asosiy kassa, Hisob raqami). Idempotent."

    @transaction.atomic
    def handle(self, *args, **options):
        n_purposes, n_accounts = seed_kassa()
        self.stdout.write(self.style.SUCCESS(f"seed_kassa ok — {n_purposes} new purposes, {n_accounts} new accounts"))
