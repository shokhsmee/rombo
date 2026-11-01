"""What uzbridge's Celery beat did, as one pass `manage.py crm_worker` runs every minute (design.md §2):
stale live calls, recordings due, task reminders, amoCRM token refresh, the 10-minute history pull."""

import logging
from datetime import timedelta

from django.utils import timezone

from apps.crm.models import LeadTask
from apps.crm.services import live

log = logging.getLogger(__name__)


def remind_due_tasks() -> int:
    """Open tasks due within (now − 10 min, now + 5 min] → the assignee (else the lead's manager) hears once."""
    now = timezone.now()
    tasks = (LeadTask.objects.filter(done=False, reminded_at__isnull=True, due_at__gt=now - timedelta(minutes=10),
                                     due_at__lte=now + timedelta(minutes=5), lead__deleted_at__isnull=True)
             .select_related("lead__manager"))
    n = 0
    for t in tasks:
        user_id = t.assignee_id or (t.lead.manager.user_id if t.lead.manager_id else None)
        when = timezone.localtime(t.due_at).strftime("%d.%m %H:%M")
        live.notify([user_id], f"Vazifa {when} da: {t.text or t.kind}", t.lead.title, f"/crm/leads/{t.lead_id}")
        LeadTask.objects.filter(pk=t.pk).update(reminded_at=now)
        n += 1
    return n


def run_once() -> dict:
    """One pass of the Celery beat jobs, in process — for dev without Redis (`manage.py crm_worker`)."""
    from apps.crm import tasks

    out = {"recordings": 0, "reminders": 0, "synced": 0}
    for name, job in (("stale", tasks.expire_stale_calls), ("recordings", tasks.archive_recordings),
                      ("reminders", tasks.remind_due_tasks), ("amocrm", tasks.refresh_amocrm_tokens),
                      ("synced", tasks.sync_connections)):
        try:
            r = job()
            if name in out:
                out[name] = r or 0
        except Exception:  # one job failing must not stop the others
            log.exception("crm_worker: %s failed", name)
    return out
