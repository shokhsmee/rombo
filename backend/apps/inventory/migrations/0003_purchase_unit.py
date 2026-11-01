# add-units-of-measure: "Xarid karrasi" (order_multiple) becomes a purchase unit with a factor
# (6.5 → "1 dona = 6.5 m"), and product units are normalised to the registry's names (шт → dona).
# Units no alias knows are added to the registry as "other" so nothing is lost.

from django.db import migrations, models


def _norm(text):
    return (text or "").strip().lower().replace(".", "").replace(" ", "").replace("²", "2").replace("³", "3")


def forwards(apps, schema_editor):
    Uom = apps.get_model("references", "Uom")
    Product = apps.get_model("inventory", "Product")
    spellings = {}
    for u in Uom.objects.all():
        for s in [u.name, *u.aliases.split(",")]:
            if s.strip():
                spellings[_norm(s)] = u.name
    for p in Product.objects.all():
        key = _norm(p.unit) or "dona"
        if key not in spellings:
            Uom.objects.create(name=p.unit.strip()[:20], category="other", ratio=1, sort_order=900)
            spellings[key] = p.unit.strip()[:20]
        p.unit = spellings[key]
        if p.order_multiple:
            p.purchase_unit, p.purchase_factor = "dona", p.order_multiple
        p.save(update_fields=["unit", "purchase_unit", "purchase_factor"])


def backwards(apps, schema_editor):
    Product = apps.get_model("inventory", "Product")
    for p in Product.objects.exclude(purchase_factor=None):
        p.order_multiple = p.purchase_factor
        p.save(update_fields=["order_multiple"])


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_yarim_order_multiple"),
        ("references", "0003_uom"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="purchase_factor",
            field=models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True,
                                      verbose_name="Xarid birligida"),
        ),
        migrations.AddField(
            model_name="product",
            name="purchase_unit",
            field=models.CharField(blank=True, default="", max_length=20, verbose_name="Xarid birligi"),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(
            model_name="product",
            name="order_multiple",
        ),
    ]
