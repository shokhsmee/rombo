# add-units-of-measure: the unit registry, seeded with every unit the data uses (Latin stock units, the Russian
# units of the price list). Ratios are to the category's base unit (m, m2, kg, l, dona).

from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

SEED = [
    # name, category, ratio, aliases
    ("dona", "count", "1", "шт, штук, ta, pcs, pc, dn"),
    ("m", "length", "1", "м, metr, метр, pm, п/м, пм"),
    ("sm", "length", "0.01", "см, cm"),
    ("mm", "length", "0.001", "мм"),
    ("m2", "area", "1", "м2, m², кв.м, квм, kv.m, kvm"),
    ("kg", "weight", "1", "кг, kilogramm"),
    ("g", "weight", "0.001", "г, гр, gr, gramm"),
    ("t", "weight", "1000", "т, tonna, тонна"),
    ("l", "volume", "1", "л, litr, литр"),
    ("komplekt", "other", "1", "компл, комплект, kompl, set"),
    ("pachka", "other", "1", "пачка, упак, упаковка, qadoq"),
    ("rulon", "other", "1", "рулон"),
    ("xizmat", "other", "1", "услуга, услуги, xizm"),
]


def seed(apps, schema_editor):
    Uom = apps.get_model("references", "Uom")
    for i, (name, category, ratio, aliases) in enumerate(SEED):
        Uom.objects.get_or_create(name=name, defaults={"category": category, "ratio": Decimal(ratio),
                                                       "aliases": aliases, "sort_order": (i + 1) * 10})


class Migration(migrations.Migration):
    dependencies = [
        ("references", "0002_seed_defaults"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Uom",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=20, unique=True, verbose_name="Nomi")),
                ("category", models.CharField(choices=[("count", "Dona"), ("length", "Uzunlik"), ("area", "Yuza"),
                                                       ("weight", "Og'irlik"), ("volume", "Hajm"),
                                                       ("other", "Boshqa")], default="count", max_length=10)),
                ("ratio", models.DecimalField(decimal_places=6, default=1, max_digits=16, verbose_name="Nisbat")),
                ("aliases", models.CharField(blank=True, default="", max_length=200,
                                             verbose_name="Boshqa yozilishi")),
                ("sort_order", models.PositiveSmallIntegerField(default=100)),
                ("is_active", models.BooleanField(default=True)),
                ("created_by", models.ForeignKey(blank=True, null=True,
                                                 on_delete=django.db.models.deletion.SET_NULL, related_name="+",
                                                 to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True,
                                                 on_delete=django.db.models.deletion.SET_NULL, related_name="+",
                                                 to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "O'lchov birligi", "verbose_name_plural": "O'lchov birliklari",
                     "ordering": ["sort_order", "name"]},
        ),
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
