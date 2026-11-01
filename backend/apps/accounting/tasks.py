"""Scheduled accounting jobs (CELERY_BEAT_SCHEDULE)."""

import logging

from celery import shared_task
from django.core.management import CommandError, call_command

log = logging.getLogger(__name__)


@shared_task(name="accounting.fetch_cbu_rates")
def fetch_cbu_rates(currency: str = "USD") -> bool:
    """Today's Central Bank rate. A manually entered rate is kept (the command's own rule)."""
    try:
        call_command("fetch_cbu_rates", currency=currency, verbosity=0)
    except CommandError as e:  # the Bank not answering is not worth a traceback every run
        log.warning("CBU rate %s: %s", currency, e)
        return False
    return True
