# Design — add-celery-redis-docker

## Decisions
1. **Celery worker and beat run in one process** (`celery -A config worker -B`), as in uzbridge. There is a
   single install with a handful of short jobs, so a separate beat container adds nothing. The beat schedule
   file lives in its own volume, so a restart doesn't re-fire every job.
2. **One task per former crm_worker job.** A slow or failing job no longer delays the others. Each periodic
   task expires before its next tick (`expires: 55` for 60 s jobs), so a stalled worker doesn't pile up runs.
3. **REDIS_URL decides the mode.**
   - Set: real broker. The channel layer also moves to Redis, so the worker and the Telegram listener reach
     the browser.
   - Empty: tasks run inline and `crm_worker` drives the schedule.

   Tests never need Redis.
4. **One backend image, three commands** (daphne / celery / telegram_listen). Dependencies sit in their own
   layer keyed on `uv.lock`.
5. **Migrations run in a one-shot `migrate` service.** api, worker and telegram start only after it
   completes, so two containers never race on a migration.
6. **nginx inside the frontend image** serves the SPA and proxies `/api`, `/ws`, `/admin`. A host proxy in
   front (TLS, other sites on the same server) forwards one port to it.
7. **Postgres in compose publishes on 5433.** The developer's own PostgreSQL (and uzbridge's DB) keep 5432.

## Rejected
- *Separate beat container* — one more process for no gain at this size.
- *django-celery-beat (DB-stored schedule)* — the schedule is code; nobody edits it from the admin.
- *Redis as cache too* — nothing needs a shared cache yet.
- *Keep crm_worker only* — no retries, no isolation between jobs, and still needs Redis for live updates.
