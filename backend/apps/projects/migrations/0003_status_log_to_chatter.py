# Status history moves from ProjectStatusLog to the generic chatter (change add-chatter-and-uzbridge-design).
# Rows are copied first so no history is lost, then the table is dropped.

from django.db import migrations

LABELS = {
    "draft": "Qoralama", "confirmed": "Tasdiqlangan", "procurement": "Xaridda",
    "production": "Ishlab chiqarishda", "ready": "Tayyor", "delivered": "Yetkazildi",
    "closed": "Yopildi", "cancelled": "Bekor qilindi",
}


def copy_to_chatter(apps, schema_editor):
    Log = apps.get_model("projects", "ProjectStatusLog")
    Message = apps.get_model("chatter", "Message")
    for log in Log.objects.select_related("user").order_by("id"):
        name = ""
        if log.user_id:
            name = f"{log.user.first_name} {log.user.last_name}".strip() or log.user.username
        if log.from_status:
            msg = Message(model="projects.project", res_id=log.project_id, kind="track", body=log.comment,
                          changes=[{"field": "status", "label": "Holat",
                                    "old": LABELS.get(log.from_status, log.from_status),
                                    "new": LABELS.get(log.to_status, log.to_status)}],
                          author=name, user_id=log.user_id)
        else:
            msg = Message(model="projects.project", res_id=log.project_id, kind="event",
                          body=log.comment or "Loyiha yaratildi", author=name, user_id=log.user_id)
        msg.save()
        Message.objects.filter(pk=msg.pk).update(created_at=log.created_at)  # keep the original time


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0002_initial"),
        ("chatter", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(copy_to_chatter, migrations.RunPython.noop),
        migrations.DeleteModel(name="ProjectStatusLog"),
    ]
