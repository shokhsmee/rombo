"""SIP passwords move from plain text to Fernet tokens (apps.core.crypto). Existing values are encrypted in
place: first a plain TextField (so the old values read back as they are), then encrypt, then the encrypted
field (same column type, no schema change)."""

from django.db import migrations, models

import apps.core.crypto


def encrypt_existing(apps, schema_editor):
    from apps.core.crypto import encrypt

    Extension = apps.get_model("crm", "Extension")
    for pk, value in Extension.objects.exclude(sip_password="").values_list("pk", "sip_password"):
        Extension.objects.filter(pk=pk).update(sip_password=encrypt(value))


def decrypt_existing(apps, schema_editor):
    from apps.core.crypto import decrypt

    Extension = apps.get_model("crm", "Extension")
    for pk, value in Extension.objects.exclude(sip_password="").values_list("pk", "sip_password"):
        Extension.objects.filter(pk=pk).update(sip_password=decrypt(value)[:128])


class Migration(migrations.Migration):
    dependencies = [("crm", "0001_initial")]

    operations = [
        migrations.AlterField("extension", "sip_password", models.TextField(blank=True, default="")),
        migrations.RunPython(encrypt_existing, decrypt_existing),
        migrations.AlterField("extension", "sip_password", apps.core.crypto.EncryptedTextField(blank=True, default="")),
    ]
