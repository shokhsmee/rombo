"""Scheduled CRM jobs (CELERY_BEAT_SCHEDULE). Each is one job of `services.worker.run_once`, so a slow
Drive upload no longer delays reminders, and a failure retries on the next tick without stopping the rest."""

import logging

from celery import shared_task

from apps.core.exceptions import DomainError

log = logging.getLogger(__name__)


@shared_task(name="crm.expire_stale_calls")
def expire_stale_calls() -> int:
    from apps.crm.services.telephony import expire_stale

    return expire_stale() or 0


@shared_task(name="crm.archive_recordings")
def archive_recordings() -> int:
    from apps.crm.services.recordings import archive_due

    return archive_due() or 0


@shared_task(name="crm.remind_due_tasks")
def remind_due_tasks() -> int:
    from apps.crm.services.worker import remind_due_tasks as remind

    return remind()


@shared_task(name="crm.refresh_amocrm_tokens")
def refresh_amocrm_tokens() -> int:
    from apps.crm.services.amocrm import amo_refresh_due

    return amo_refresh_due() or 0


@shared_task(name="crm.sync_connections")
def sync_connections() -> int:
    """Pull history of every connection that is due; one connection failing doesn't stop the others."""
    from apps.crm.models import Connection
    from apps.crm.services.connections import connection_sync, sync_due

    synced = 0
    for pk in sync_due():
        try:
            connection_sync(Connection.objects.get(pk=pk), days=1)
            synced += 1
        except DomainError as e:
            log.warning("crm sync %s: %s", pk, e)
    return synced
