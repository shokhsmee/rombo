# Change: add-celery-redis-docker  (status: archived 2026-11-01)

## Why
- Background work ran as an endless `manage.py crm_worker` loop. One slow job, such as a Drive upload,
  delayed the rest. Nothing retried. The CBU rate had to be fetched by an external cron nobody set up.
- Live updates across processes (worker, Telegram listener → browser) need Redis, which was optional and absent.
- The owner wants the same Docker setup locally and in production, like uzbridge.

## What changes
- Celery (`config/celery.py`, `CELERY_*` settings) with Redis as broker. The beat schedule runs the CRM jobs
  every minute (amoCRM tokens every 5 min) and the CBU USD rate at 09:10 and 18:10 Tashkent.
- Tasks: `apps/crm/tasks.py` (one task per former crm_worker job), `apps/accounting/tasks.py`
  (`fetch_cbu_rates`).
- `crm_worker` stays as the no-Redis fallback and runs the same task functions in process.
- Without `REDIS_URL`, tasks run inline (`CELERY_TASK_ALWAYS_EAGER`). Tests and Docker-less dev work unchanged.
- Docker:
  - `backend/Dockerfile`: one image for api, worker and telegram.
  - `frontend/Dockerfile`: Vite build served by nginx, which proxies `/api`, `/ws`, `/admin`.
  - `docker-compose.yml`: db, redis, migrate (one-shot), backend, worker (+beat), telegram, frontend.
- `fetch_cbu_rates` and the kassa summary use the Tashkent date (`timezone.localdate()`).

## Impact
New deps `celery`, `redis`. New files `config/celery.py`, `apps/*/tasks.py`, Dockerfiles, `docker-compose.yml`,
`frontend/nginx.conf`. ADR 0013. No migration. Production currently runs systemd units (`rombo-erp.service`).
Moving it to compose is a separate deploy step.
