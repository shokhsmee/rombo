"""Seed the profile system for the seeded price list "Rombo Termo 306J 65 seriya" and grant the new pages.

Widths follow Romchi 2.0 `calculationProfileDetails` for TERMO_65 (frame / impost / sash 38 mm); the rest
are common PVC values. `needs_check` stays on until the workshop confirms them (tasks 0.2)."""

from decimal import Decimal

from django.db import migrations

# (role, price-list item name, unit, factor, round up)
MAP = [
    ("frame", "L -ka", "шт", "1", False),
    ("sash", "Z-ka", "шт", "1", False),
    ("mullion", "T-ka", "шт", "1", False),
    ("door_sash", "Балкон Z", "шт", "1", False),
    ("bead", "Штапик квадрат", "шт", "1", False),
    ("mullion_ends", "Соединитель импост", "шт", "1", True),
    ("tilt_turn", "Фурнитура оконная ПВО", "шт", "1", True),
    ("turn", "Фурнитура оконная обыч.откр.", "шт", "1", True),
    ("tilt", "Фурнитура оконная обыч.откр.", "шт", "1", True),
    ("door", "Замок", "шт", "1", True),
    ("door", "Петля дверная 3ска", "шт", "3", True),
    ("rubber_frame", "Резина Босма A001 - юшка", "м", "1", False),
    ("rubber_glass", "Резина Босма A002 - босма стеклопакет таги", "м", "1", False),
    ("rubber_sash", "Резина Босма A003 - створка (L+T+Z) майда", "м", "1", False),
    ("lambri_m2", "Ламбри алкафон", "шт", "1.7", True),
    ("constructions", "Транспорт/Саморез", "шт", "1", True),
    ("area_m2", "Пена", "шт", "0.3", True),
    ("area_m2", "услуги", "м2", "1", False),
]

FULL = dict(can_view=True, can_create=True, can_update=True, can_delete=True)
VIEW = dict(can_view=True)
GRANTS = {
    "Administrator": {"constructions": FULL, "profile_systems": FULL},
    "Savdo menejeri": {"constructions": FULL, "profile_systems": VIEW},
    "Ta'minotchi": {"constructions": VIEW},
}


def seed(apps, schema_editor):
    PriceList = apps.get_model("pricing", "PriceList")
    ProfileSystem = apps.get_model("konstruktor", "ProfileSystem")
    Item = apps.get_model("konstruktor", "ProfileSystemItem")
    pl = PriceList.objects.filter(name="Rombo Termo 306J 65 seriya").first()
    if pl is not None and not ProfileSystem.objects.filter(name="Rombo Termo 65").exists():
        items = {(it.name, it.unit): it for it in pl.items.all()}
        system = ProfileSystem.objects.create(
            name="Rombo Termo 65", price_list=pl, product_type_id=pl.product_type_id,
            bar_length_mm=Decimal(int((pl.bar_length_m or Decimal("6.5")) * 1000)), kerf_mm=Decimal("5"),
            frame_width=Decimal("38"), mullion_width=Decimal("38"), sash_width=Decimal("38"),
            weld_allowance=Decimal("3"), mullion_allowance=Decimal("6"), sash_overlap=Decimal("8"),
            glass_deduction_fixed=Decimal("10"), glass_deduction_sash=Decimal("10"),
            default_glass=items.get(("Стекло пакет пепель", "м2")), needs_check=True,
            notes="Romchi 2.0 TERMO_65 qiymatlari asosida. Sex tasdiqlagach «Sex tasdiqlamagan» belgisini oling.",
        )
        for i, (role, name, unit, factor, up) in enumerate(MAP):
            it = items.get((name, unit))
            if it is not None:
                Item.objects.create(system=system, sort_order=(i + 1) * 10, role=role, price_list_item=it,
                                    factor=Decimal(factor), round_up=up)

    Role = apps.get_model("access", "Role")
    RolePermission = apps.get_model("access", "RolePermission")
    for role_name, perms in GRANTS.items():
        role = Role.objects.filter(name=role_name).first()
        if role is not None:
            for key, flags in perms.items():
                RolePermission.objects.update_or_create(role=role, page_key=key, defaults=flags)


class Migration(migrations.Migration):
    dependencies = [
        ("konstruktor", "0001_initial"),
        ("pricing", "0002_seed_termo_306j"),
        ("access", "0002_initial"),
    ]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
