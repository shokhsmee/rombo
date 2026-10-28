# The first price list, copied from the sales department's hisob-kitob sheet
# ("Rombo Termo 306J 65seriya - 6,5 m", 06.08.2026). Names and units kept exactly as sales writes them.

from decimal import Decimal

from django.db import migrations

ITEMS = [
    ("L -ka", "шт", "51.4"),
    ("Z-ka", "шт", "55"),
    ("T-ka", "шт", "58.8"),
    ("Балкон T", "шт", "80.2"),
    ("Балкон Z", "шт", "78.5"),
    ("Штапик квадрат", "шт", "16.9"),
    ("Ламбри алкафон", "шт", "50"),
    ("Штульп", "шт", "55.8"),
    ("Елка+клей", "шт", "3"),
    ("Соединитель импост", "шт", "0.3"),
    ("Шпингалет", "компл", "30"),
    ("Фурнитура оконная ПВО", "шт", "71"),
    ("Фурнитура оконная обыч.откр.", "шт", "23"),
    ("Замок", "шт", "55"),
    ("Петля дверная 3ска", "шт", "15"),
    ("Петля дверная 2ска", "шт", "11"),
    ("Стекло пакет пепель", "м2", "16"),
    ("Стекло пакет колонний", "м2", "30"),
    ("Резина Босма A001 - юшка", "м", "0.25"),
    ("Резина Босма A002 - босма стеклопакет таги", "м", "0.4"),
    ("Резина Босма A003 - створка (L+T+Z) майда", "м", "0.25"),
    ("Резина Босма A005 - урта резин калин", "м", "1"),
    ("Транспорт/Саморез", "шт", "5"),
    ("Пена", "шт", "5.5"),
    ("Соединитель лапша", "кг", "25"),
    ("Адоптор труба", "шт", "137"),
    ("Арка", "м", "18"),
    ("Подокон 25", "шт", "32.61"),
    ("Подокон 30", "шт", "38.16"),
    ("Подокон 35", "шт", "44.1"),
    ("Подокон 40", "шт", "54.64"),
    ("Подокон 25", "м", "6"),
    ("Подокон 30", "м", "7"),
    ("Подокон 35", "м", "8"),
    ("Подокон 40", "м", "10"),
    ("Демонтаж", "шт", "10"),
    ("маскит. Сетка хайтек", "шт", "15"),
    ("услуги", "м2", "50"),
]


def seed(apps, schema_editor):
    PriceList = apps.get_model("pricing", "PriceList")
    PriceListItem = apps.get_model("pricing", "PriceListItem")
    RefItem = apps.get_model("references", "RefItem")
    if PriceList.objects.filter(name="Rombo Termo 306J 65 seriya").exists():
        return
    pl = PriceList.objects.create(
        name="Rombo Termo 306J 65 seriya", bar_length_m=Decimal("6.5"), currency="USD",
        product_type=RefItem.objects.filter(kind="product_type", name="Termo").first(),
        notes="Narx tijorat taklifi berilgan sanaga ko'rsatilgan.",
    )
    PriceListItem.objects.bulk_create(
        PriceListItem(price_list=pl, sort_order=(i + 1) * 10, name=n, unit=u, price=Decimal(p))
        for i, (n, u, p) in enumerate(ITEMS)
    )

    Role = apps.get_model("access", "Role")
    RolePermission = apps.get_model("access", "RolePermission")
    for role in Role.objects.filter(name="Administrator"):
        for key, flags in (("pricing", dict(can_view=True, can_create=True, can_update=True, can_delete=True)),
                           ("company", dict(can_view=True, can_update=True))):
            RolePermission.objects.update_or_create(role=role, page_key=key, defaults=flags)


class Migration(migrations.Migration):

    dependencies = [
        ("pricing", "0001_initial"),
        ("references", "0002_seed_defaults"),
        ("access", "0001_initial"),
    ]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
