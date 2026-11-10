from django.db import migrations

FULL = dict(can_view=True, can_create=True, can_update=True, can_delete=True)
MCP = dict(can_view=True, can_create=True, can_delete=True)
VIEW = dict(can_view=True)
EDIT = dict(can_view=True, can_create=True, can_update=True)

ANALYST = "MCP tahlilchi"
ANALYST_PERMS = {"dashboard": VIEW, "mcp": MCP, "specs": VIEW, "fix_ideas": EDIT}
ADMIN_PERMS = {"mcp": MCP, "specs": VIEW, "fix_ideas": FULL}


def grant(apps, schema_editor):
    """Databases seeded before this change: Administrator sees the new pages, the analyst role exists.
    Fresh databases get the same from `manage.py seed` (get_or_create keeps both paths idempotent)."""
    Role = apps.get_model("access", "Role")
    RolePermission = apps.get_model("access", "RolePermission")
    admin = Role.objects.filter(name="Administrator").first()
    if admin is not None:
        for key, flags in ADMIN_PERMS.items():
            RolePermission.objects.update_or_create(role=admin, page_key=key, defaults=flags)
    if Role.objects.exists():  # a seeded database; an empty one gets the role from `seed`
        role, created = Role.objects.get_or_create(
            name=ANALYST,
            defaults={"description": "Claude orqali tizim va spetsifikatsiyalarni ko'radi, takliflar yozadi",
                      "is_system": True},
        )
        if created:
            RolePermission.objects.bulk_create(
                RolePermission(role=role, page_key=k, **v) for k, v in ANALYST_PERMS.items()
            )


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0002_initial"),
        ("specs", "0001_initial"),
    ]

    operations = [migrations.RunPython(grant, migrations.RunPython.noop)]
