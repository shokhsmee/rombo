<picture>
  <source media="(prefers-color-scheme: dark)" srcset="frontend/public/brand/rombo-logo-white.svg">
  <img src="frontend/public/brand/rombo-logo.svg" alt="Rombo — фабрика сборки окон и дверей" height="48">
</picture>

# Rombo ERP

ERP for Rombo (Akfa-profile windows/doors). Every operation hangs off a **Loyiha** (customer order).

| | |
|---|---|
| Backend | Django 5 + DRF — `backend/` |
| Frontend | React + TypeScript + Vite + Tailwind v4 (uzbridge design) — `frontend/` |
| Architecture log | `openspec/` (specs, changes, archive), `docs/adr/`, `CHANGELOG.md` |
| Rules for contributors / AI agents | [`AGENTS.md`](AGENTS.md) — read before changing code |
| Brand (logo, mark, favicon) | `frontend/public/brand/` · in code `components/Brand.tsx` |

## Run everything in Docker

Requirements: Docker (Desktop on Windows). Settings and secrets go in `backend/.env` as below.

```bash
docker compose up -d --build                # db, redis, migrate, backend, worker (Celery + beat), telegram, frontend
docker compose exec backend python manage.py seed
```

The app answers on http://localhost:8080 (`HTTP_PORT`). Logs: `docker compose logs -f worker`. Compose variables
(`POSTGRES_PASSWORD`, `HTTP_PORT`, `POSTGRES_PORT`) can go in a root `.env`. See ADR 0013.

## Run locally

Requirements: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 20+, PostgreSQL 16 (or SQLite for a quick
look), and Docker for Redis.

```bash
cd backend
cp .env.example .env                 # DATABASE_URL=postgres://…, REDIS_URL=redis://127.0.0.1:6379/0
uv sync --extra postgres
docker compose up -d redis           # from the repo root
uv run python manage.py migrate
uv run python manage.py seed        # roles + first superuser (see .env)
uv run python manage.py seed_demo   # optional sample data
uv run python manage.py runserver
```

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173 (proxies /api to :8000)
```

`runserver` is daphne's: it serves the API and the live-updates WebSocket (`/ws/live/`) in one process.
Scheduled jobs (CRM every minute, the Central Bank rate twice a day) and Telegram run as two more processes:

```bash
uv run celery -A config worker -B -l info --pool solo   # Celery worker + beat (--pool solo: Windows only)
uv run python manage.py telegram_listen                 # keeps connected Telegram accounts online
```

Without Redis (`REDIS_URL` empty) tasks run inline; `uv run python manage.py crm_worker` then runs the same
schedule in a loop.

Production: `docker compose up -d --build`, or daphne + the two commands above as services, with `REDIS_URL` set
so all processes share live updates.
External accounts (amoCRM, PBX keys, Telegram, Google Drive) are filled in the app or `backend/.env`
(see `.env.example`); secrets in the database are encrypted with `FIELD_ENCRYPTION_KEY`.

- API docs: http://localhost:8000/api/v1/docs/
- Django admin: http://localhost:8000/admin/
- Tests: `cd backend && uv run pytest`

Dev login comes from `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` in `backend/.env`.
Change it before any shared deployment.

## Layout

```
backend/
  config/            settings, urls
  apps/core/         base models (audit, soft delete), errors, pagination, ServiceModelViewSet
  apps/access/       page registry, roles, page × CRUD permissions
  apps/users/        login accounts, JWT auth
  apps/employees/    staff (HR card)
  apps/clients/      customers
  apps/projects/     Loyihalar — status workflow
  apps/chatter/      record history + notes (TRACK on models)
frontend/src/
  components/        ui kit, DataTable, Record (record page), Chatter, EntitySelect…
  modules/<name>/    api.ts + list page + form page per module
openspec/            what the system does and why it changed
```
