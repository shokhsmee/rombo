# Tasks

- [x] `celery`, `redis` dependencies
- [x] `config/celery.py`, `CELERY_*` settings, beat schedule
- [x] `apps/crm/tasks.py`, `apps/accounting/tasks.py`; `crm_worker` runs the same tasks
- [x] Tashkent date in `fetch_cbu_rates` and the kassa summary
- [x] `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `.dockerignore`s
- [x] `docker-compose.yml` (db, redis, migrate, backend, worker, telegram, frontend)
- [x] README, `.env.example`, ADR 0013
- [ ] `docker compose up` verified (needs Docker Desktop on the dev PC)
- [ ] Production moved from systemd units to compose (separate deploy)
