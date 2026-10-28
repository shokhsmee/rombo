from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.access.models import Role, RolePermission
from apps.access.registry import Pages
from apps.users.models import User

FULL = dict(can_view=True, can_create=True, can_update=True, can_delete=True)
EDIT = dict(can_view=True, can_create=True, can_update=True)
VIEW = dict(can_view=True)

DEFAULT_ROLES = {
    "Administrator": ("Barcha sahifalarga to'liq ruxsat", {
        Pages.DASHBOARD: VIEW, Pages.PROJECTS: FULL, Pages.CLIENTS: FULL, Pages.CLIENT_MAP: VIEW,
        Pages.EMPLOYEES: FULL, Pages.USERS: FULL, Pages.ROLES: FULL, Pages.REFERENCES: FULL, Pages.PRICING: FULL,
        Pages.COMPANY: dict(can_view=True, can_update=True), Pages.PROCUREMENT: FULL, Pages.MRP: FULL,
        Pages.CRM: FULL, Pages.TELEPHONY: FULL, Pages.TELEGRAM: FULL,
    }),
    "Savdo menejeri": ("Loyiha va mijozlar bilan ishlaydi", {
        Pages.DASHBOARD: VIEW, Pages.PROJECTS: EDIT, Pages.CLIENTS: EDIT, Pages.CLIENT_MAP: VIEW,
        Pages.EMPLOYEES: VIEW, Pages.PRICING: VIEW, Pages.CRM: EDIT, Pages.TELEPHONY: VIEW, Pages.TELEGRAM: VIEW,
    }),
    "Ta'minotchi": ("Xaridlar bo'limi", {
        Pages.DASHBOARD: VIEW, Pages.PROJECTS: VIEW, Pages.PROCUREMENT: EDIT,
    }),
}


class Command(BaseCommand):
    help = "Create default roles and the first superuser (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        for name, (desc, perms) in DEFAULT_ROLES.items():
            role, created = Role.objects.get_or_create(name=name, defaults={"description": desc,
                                                                            "is_system": True})
            if created:
                RolePermission.objects.bulk_create(
                    RolePermission(role=role, page_key=k, **v) for k, v in perms.items()
                )
        username = settings.SEED_ADMIN_USERNAME
        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username=username, password=settings.SEED_ADMIN_PASSWORD,
                                          first_name="Tizim", last_name="administratori", email="")
        self.stdout.write(self.style.SUCCESS(f"seed ok — login: {username}"))
