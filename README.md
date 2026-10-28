# Rombo ERP

ERP for Rombo (Akfa-profile windows/doors). Every operation hangs off a **Loyiha** (customer order).

| | |
|---|---|
| Backend | Django 5 + DRF — `backend/` |
| Frontend | React + TypeScript + Vite + Tailwind v4 (uzbridge design) — `frontend/` |
| Architecture log | `openspec/` (specs, changes, archive), `docs/adr/`, `CHANGELOG.md` |
| Rules for contributors / AI agents | [`AGENTS.md`](AGENTS.md) — read before changing code |

## Run locally

Requirements: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 20+.

```bash
cd backend
cp .env.example .env
uv sync
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
