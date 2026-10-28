# Requisites from the contract sample (Шартнома намунаси). Edit in Sozlamalar → Kompaniya.

from django.db import migrations


def seed(apps, schema_editor):
    Company = apps.get_model("company", "Company")
    Company.objects.get_or_create(pk=1, defaults=dict(
        name="Rombo Group", legal_form="OK", director="Акмалов Рамазон", director_short="Акмалов Р.",
        city="Самарканд", address="Абдурауф Фитрат 71", bank_account="20208000905459689001", mfo="01158",
        inn="309036414", phone="+998932280080", delivery_days=25, prepay_percent=50,
    ))


class Migration(migrations.Migration):

    dependencies = [("company", "0001_initial")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
