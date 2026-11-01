# ADR 0013 — Celery + Redis for background work, Docker for running the stack

- Status: accepted
- Date: 2026-11-01
- Relates to: change `add-celery-redis-docker`; uzbridge uses the same setup

## Context
- Background work was a `while True` loop (`manage.py crm_worker`). It had no retries, and one slow job
  delayed the others.
- Daily jobs, such as the Central Bank rate, needed an external cron nobody set up.
- Live updates from the worker and the Telegram listener need a shared channel layer.
- The owner wants local and production to run the same containers.

## Decision
1. Redis is the Celery broker and the Channels layer (`REDIS_URL`).
2. Celery runs the schedule (`CELERY_BEAT_SCHEDULE` in settings) and background tasks. Tasks live in
   `apps/<app>/tasks.py` and only call that app's services: the same layering as views (ADR 0002).
3. Worker and beat share one process (`celery -A config worker -B`).
4. Without `REDIS_URL`, tasks run inline, and `crm_worker` stays as the in-process scheduler for dev and tests.
5. Docker: one backend image for api, worker and telegram; nginx in the frontend image; `docker-compose.yml`
   for the whole stack. On a dev PC `docker compose up -d redis` is enough to run Django and Vite on the host.

## Rejected
- *Cron + management commands* — no retries or isolation, and it's yet another thing to configure on every
  server.
- *Dramatiq / RQ* — uzbridge already runs Celery, so one tool across both projects.
- *Separate beat container, django-celery-beat* — see the change's design.md.

## Consequences
- New code that must not block a request (emails, external APIs, imports) goes into a task.
- Every periodic task sets `expires` shorter than its interval.
- Production needs Redis (in compose, or the host's `redis-server`) before the worker starts.
