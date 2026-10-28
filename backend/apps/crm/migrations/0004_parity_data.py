"""Data for add-crm-full-parity:
- task kinds (call/meeting/…) become the task type names CrmSettings.task_types holds;
- the PBX webhook token, SIP address and company numbers move from TelephonySettings to a "pbx" Connection
  (the same token, so the PBX keeps posting to the same URL);
- the two "creates lead" switches become the unknown-number actions;
- every pipeline gets the default lost reasons; CrmSettings gets its row."""

from django.db import migrations

KINDS = {"call": "Qo'ng'iroq", "meeting": "Uchrashuv", "measure": "O'lchov", "message": "Xabar yozish",
         "other": "Boshqa"}
TASK_TYPES = ["Qo'ng'iroq", "Uchrashuv", "O'lchov", "Xabar yozish", "Boshqa"]
LOST = ["Qimmat", "Boshqa joydan oldi", "Javob bermayapti", "Hozir kerak emas", "Noto'g'ri raqam"]
CARD = ["customer", "phone", "budget", "tags", "source", "manager", "task"]


def forward(apps, schema_editor):
    LeadTask = apps.get_model("crm", "LeadTask")
    for old, new in KINDS.items():
        LeadTask.objects.filter(kind=old).update(kind=new)

    CrmSettings = apps.get_model("crm", "CrmSettings")
    CrmSettings.objects.get_or_create(pk=1, defaults={"task_types": TASK_TYPES, "card_fields": CARD})

    Pipeline, LostReason = apps.get_model("crm", "Pipeline"), apps.get_model("crm", "LostReason")
    for p in Pipeline.objects.all():
        if not LostReason.objects.filter(pipeline=p).exists():
            LostReason.objects.bulk_create(LostReason(pipeline=p, text=t, position=i) for i, t in enumerate(LOST))

    TelephonySettings = apps.get_model("crm", "TelephonySettings")
    Connection, Extension = apps.get_model("crm", "Connection"), apps.get_model("crm", "Extension")
    st = TelephonySettings.objects.filter(pk=1).first()
    if st is None:
        return
    st.incoming_unknown = "create_lead" if st.incoming_creates_lead else "nothing"
    st.missed_unknown = "create_lead" if st.missed_creates_lead else "nothing"
    st.save(update_fields=["incoming_unknown", "missed_unknown"])
    conn = Connection.objects.create(
        kind="pbx", name="IP-telefoniya", enabled=st.enabled, token=st.webhook_token,
        config={"sip_wss": st.sip_wss, "sip_domain": st.sip_domain, "numbers": st.company_numbers},
        status="ok" if st.last_event_at else "new", last_event_at=st.last_event_at, secrets="",
    )
    Extension.objects.filter(connection__isnull=True).update(connection=conn)
    apps.get_model("crm", "Call").objects.filter(connection__isnull=True, source="webhook").update(connection=conn)


def backward(apps, schema_editor):
    LeadTask = apps.get_model("crm", "LeadTask")
    for old, new in KINDS.items():
        LeadTask.objects.filter(kind=new).update(kind=old)
    Connection = apps.get_model("crm", "Connection")
    conn = Connection.objects.filter(kind="pbx").order_by("id").first()
    st = apps.get_model("crm", "TelephonySettings").objects.filter(pk=1).first()
    if conn and st:
        cfg = conn.config or {}
        st.webhook_token, st.sip_wss = conn.token, cfg.get("sip_wss", "")
        st.sip_domain, st.company_numbers = cfg.get("sip_domain", ""), cfg.get("numbers", "")
        st.save()


class Migration(migrations.Migration):
    dependencies = [("crm", "0003_parity_fields")]

    operations = [migrations.RunPython(forward, backward)]
