"""Celery: the scheduled jobs (CELERY_BEAT_SCHEDULE in settings) and background tasks. Same setup as uzbridge.

Run: `celery -A config worker -B -l info` (worker + beat in one process; Windows dev adds `--pool solo`).
Without REDIS_URL tasks run inline (CELERY_TASK_ALWAYS_EAGER) and beat is not needed: `manage.py crm_worker`
still runs the same jobs in a loop.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("rombo")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
