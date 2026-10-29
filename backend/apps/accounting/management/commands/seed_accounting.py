from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounting.seed import seed_chart


class Command(BaseCommand):
    help = "Load the NSBU 21 chart of accounts subset and the account roles (idempotent: updates by code)."

    @transaction.atomic
    def handle(self, *args, **options):
        n_acc, n_roles = seed_chart()
        self.stdout.write(self.style.SUCCESS(f"seed_accounting ok — {n_acc} accounts, {n_roles} roles"))
