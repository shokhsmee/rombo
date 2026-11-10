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

## Servis bots and Mini Apps

After-sales service (Servis → Arizalar, Ustalar) has two Telegram bots, each with a Mini App:

| | Bot | Mini App |
|---|---|---|
| Mijoz (client) | share phone → linked to the client (or a new one); gets status messages, rates the job | `/app/client/` — new request with photos and location, my requests, rate / reopen / cancel |
| Usta (master) | share phone → linked only if an active master has it; new jobs with accept / decline | `/app/master/` — active jobs, history, accept / start / finish with report and photos |

1. Create two bots in @BotFather and put the tokens in `backend/.env`: `SERVICE_CLIENT_BOT_TOKEN`,
   `SERVICE_MASTER_BOT_TOKEN`, plus `SERVICE_WEBHOOK_SECRET` (any random string).
2. Mini Apps need **https**: `PUBLIC_BASE_URL=https://erp.example.uz` → `…/app/client/`, `…/app/master/`.
3. Production: `uv run python manage.py service_bots --set-webhook` once. Without https (dev):
   `uv run python manage.py service_bots` polls (Docker: `docker compose --profile bots up -d`;
   systemd: `deploy/rombo-erp-bots.service`).
4. Add masters in Servis → Ustalar with the phone they use in Telegram; they press /start and share the number.

Testing inside Telegram from a dev machine: run a tunnel to Vite (`cloudflared tunnel --url http://localhost:5173`)
and set `SERVICE_WEBAPP_URL=https://<x>.trycloudflare.com/app`. To look at the Mini App in a plain browser set
`SERVICE_MINIAPP_DEV=True` (DEBUG only) and open `http://localhost:5173/app/client/?dev=<telegram id of a bot user>`.

## Claude (MCP) and specs

Staff can connect Claude to the ERP. Claude works **as that user, with that user's permissions**: it reads data,
does things only after the user confirms, reads the OpenSpec specs and files fix ideas (Tizim → Takliflar).

1. The user needs page **Claude (MCP) ulanish** (role "MCP tahlilchi" or Administrator) and opens
   Tizim → Claude ulanish → **Yangi token** (`Faqat o'qish` or `O'qish va yozish`). The token is shown once.
2. Connect:
   - claude.ai / Claude Desktop: Settings → Connectors → Add custom connector → paste the **connector URL**
     (`<PUBLIC_BASE_URL>/api/v1/mcp/t/<token>/` — it is a secret; revoke it in the same page);
   - Claude Code: `claude mcp add --transport http rombo <PUBLIC_BASE_URL>/api/v1/mcp/ --header "Authorization: Bearer <token>"`.
3. Specs are read from the database: run `uv run python manage.py specs_sync` after every deploy (Docker does it in
   `migrate`). `--check` also prints OpenSpec problems; `apps/specs/tests.py` fails on them. See ADR 0014.

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
  apps/maintenance/  Servis: masters, service requests, the two bots, Mini App API
frontend/src/
  components/        ui kit, DataTable, Record (record page), Chatter, EntitySelect…
  modules/<name>/    api.ts + list page + form page per module
  miniapp/           Telegram Mini Apps (client + master), entry miniapp.html → /app/
openspec/            what the system does and why it changed
```
