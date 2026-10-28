# Default lists so the order card works on day one. Admins edit them in Sozlamalar → Ma'lumotnomalar.
# Also gives the seeded "Administrator" role access to the new page.

from django.db import migrations

DEFAULTS = {
    "product_type": ["Termo", "PVX", "Novation", "Kolenoe", "Aldoks"],  # from the sales order card
    "sales_channel": ["Salon / do'kon", "Diler", "Hamkor (dizayner, quruvchi)", "Instagram / Telegram",
                      "Tavsiya", "Korporativ / tender"],
    "client_segment": ["Ekonom", "Standart", "Premium", "VIP"],
    "brand": ["Akfa"],
}


def seed(apps, schema_editor):
    RefItem = apps.get_model("references", "RefItem")
    for kind, names in DEFAULTS.items():
        for i, name in enumerate(names):
            RefItem.objects.get_or_create(kind=kind, name=name, defaults={"sort_order": (i + 1) * 10})

    Role = apps.get_model("access", "Role")
    RolePermission = apps.get_model("access", "RolePermission")
    for role in Role.objects.filter(name="Administrator"):
        RolePermission.objects.update_or_create(
            role=role, page_key="references",
            defaults=dict(can_view=True, can_create=True, can_update=True, can_delete=True))


class Migration(migrations.Migration):

    dependencies = [
        ("references", "0001_initial"),
        ("access", "0001_initial"),
    ]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
