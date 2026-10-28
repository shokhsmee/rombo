"""What uzbridge's Celery beat did, as one pass `manage.py crm_worker` runs every minute (design.md §2):
stale live calls, recordings due, task reminders, amoCRM token refresh, the 10-minute history pull."""

import logging
from datetime import timedelta

from django.utils import timezone

from apps.core.exceptions import DomainError
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
    from apps.crm.models import Connection
    from apps.crm.services.amocrm import amo_refresh_due
    from apps.crm.services.connections import connection_sync, sync_due
    from apps.crm.services.recordings import archive_due
    from apps.crm.services.telephony import expire_stale

    out = {"recordings": 0, "reminders": 0, "synced": 0}
    for name, job in (("stale", expire_stale), ("recordings", archive_due), ("reminders", remind_due_tasks),
                      ("amocrm", amo_refresh_due)):
        try:
            r = job()
            if name in out:
                out[name] = r or 0
        except Exception:  # one job failing must not stop the others
            log.exception("crm_worker: %s failed", name)
    for pk in sync_due():
        try:
            connection_sync(Connection.objects.get(pk=pk), days=1)
            out["synced"] += 1
        except DomainError as e:
            log.warning("crm_worker: sync %s: %s", pk, e)
    return out
