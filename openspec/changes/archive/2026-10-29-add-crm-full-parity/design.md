# Design: add-crm-full-parity

Source: uzbridge `backend/crm/*`, `backend/amocrm/*`, `backend/tgchat/*`, `backend/core/{crypto,realtime}.py`,
`backend/realtime_ws.py`, `frontend/src/crm/*`, `frontend/src/telegram/*`.

## 1. Inventory — every uzbridge file, ported or not

### backend/crm
| File | What it does | Rombo |
|---|---|---|
| models.py | Pipeline, Stage, LostReason, Lead, LeadEvent, LeadField, CustomerData, LeadOrder, LeadSale, CrmSettings, Connection, IntakeLog, Call, CallAnalysis, Extension | ported: all except LeadOrder/LeadSale (uzbridge Sotuvlar/Shaxmatka; Rombo's equivalent is Lead→Loyiha, done). LeadEvent → chatter + LeadTask (kept from add-crm-telephony); CustomerData → `crm.ClientData` |
| services.py | pipelines, board, cards, move, events, bulk | ported (board card fields: tags, custom, last activity, missed calls, days in stage, dup) |
| routing.py | number → customer → open lead, new_lead | ported (`services/routing.py`); "customer" = `clients.Client` created through `clients.services.client_create` |
| phones.py | normal form + 9-digit key | ported earlier |
| normalize.py | generic PBX payload | ported earlier; now also dispatches to UTeL / Moi Zvonki readers |
| telephony.py | ingest, rules, link, lead_from_call, expire_stale, stats, sync, originate | ported; rules extended to uzbridge's full set |
| utel.py | UTeL login/token, call-history, webhook + history readers | ported (`providers/utel.py`) |
| moizvonki.py | Moi Zvonki calls.list, make_call, webhook subscribe/list/unsubscribe, readers | ported (`providers/moizvonki.py`) |
| rest.py | generic REST client (auth modes, list unwrap) | ported (`providers/rest.py`) |
| catalog.py | connection kinds and their form fields | ported (`catalog.py`) + amoCRM kind |
| intake.py | form / Yuboraman payload → lead, pull mode | ported (`services/intake.py`) |
| hooks_api.py | public telephony + lead webhooks | ported (`/telephony/hook/<token>/`, `/crm/hooks/leads/<token>/`) |
| recordings.py | Google Drive archive, retries, signed playback | ported (`services/recordings.py`, `providers/google.py`) |
| analysis.py | AI transcription + review | **not ported — the user does not want AI call analysis (2026-10-29)** |
| analytics.py | voronka + telephony analytics | ported (`selectors_analytics.py`) |
| extras.py | duplicates, merge, distribution (pick_manager), clinic pipeline | ported except clinic (uzbridge Klinika module) |
| tasks.py | Celery: sync_all, sync_connection, archive_recording, analyze_call | ported as `crm_worker` jobs (§2), except analyze_call (no AI) |
| views.py | `/d/rec/<token>` Drive stream | ported (`/api/v1/telephony/recordings/<token>/`) |
| i18n.py | Russian labels for server-written strings | not applicable: Rombo's UI is Uzbek-only (AGENTS.md §3) |
| api.py | all CRM endpoints | ported as DRF viewsets/actions (list below) |
| management/commands/crm_repair_utel.py | one-off fix of uzbridge data where the company line became a client | ported as `crm_repair_utel` (same dry-run / --apply) |

### backend/amocrm
uzbridge's amoCRM app is an **amoCRM add-on**: payment links (Payme/Click/Uzum/OCTO invoices), SMS templates,
documents and "Счета/покупки" bills pushed *into* amoCRM deals, a marketplace (amoМаркет) install with
claim codes, an embedded widget and iframes. It never imports leads.

| Part | Rombo |
|---|---|
| oauth.py (code exchange, refresh with row lock, host whitelist, 2 h margin) | ported (`providers/amocrm.py`) — manual-keys connect only |
| client.py (v4 client, rate limit 7/s, 401 refresh+retry, 429 backoff) | ported (`providers/amocrm.py`) |
| services.connect, sync_pipelines, subscribe_webhook, disconnect | ported |
| webhooks (stage / update hook with token in URL) | ported: re-reads the deal and imports it |
| **new in Rombo**: deal + main contact import into Rombo leads (amoCRM as a *lead source*, which is what Rombo needs) | added, built on the same client |
| invoices / bills / bill_pay / payment links, SMS templates, documents, catalog sync, realty, embed/iframe, widget_api, AmoUserLink embedding | not applicable: they push uzbridge's **billing/payments**, SMS, document and catalog modules into amoCRM; Rombo has none of these modules, and Rombo is the CRM, not an amoCRM add-on |
| market.py, AmoInstall, AmoPendingAccount, activation codes, connect button | not applicable: uzbridge multi-tenant marketplace distribution |

### backend/tgchat (+ frontend/src/telegram)
| Part | Rombo |
|---|---|
| Account (employee's own Telegram, Telethon StringSession, 2FA) | ported (`apps/telegram`) |
| Chat (metadata only, avatar bytes, unread, read marks) | ported; `customer` → `client`, `lead` → `crm.Lead` |
| client.py login (send_code / sign_in / 2FA / friendly errors) | ported |
| listener.py + telegram_listen (one connection per session, RPC over Redis) | ported; RPC queue on `REDIS_URL` when set, else direct short-lived connection (uzbridge's own fallback) |
| ops.py (send, send_file, edit, delete, read, history, media, dialogs, logout) | ported |
| services.py (ingest → client + lead, make_lead, link/new client) | ported |
| api.py | ported as DRF views under `/api/v1/telegram/` |
| Chats.tsx, Accounts.tsx, media.tsx, live.ts | ported (`modules/telegram`) |
| message text never stored | kept (test scans the tables) |

### backend/core + realtime_ws.py
| Part | Rombo |
|---|---|
| core/crypto.py (MultiFernet field, mask) | ported (`apps/core/crypto.py`) |
| core/realtime.py + realtime_ws.py (Redis pub/sub + separate uvicorn ASGI service, session cookie) | ported on **Django Channels**: `/ws/live/?token=<JWT>`, groups `rt.all` / `rt.user.<id>`, ping 25 s |

### frontend/src/crm
| File | Rombo |
|---|---|
| Board.tsx (kanban, list, quick add with duplicate hint, auto-assign checkbox, list sort, inline stage) | ported into `modules/crm/BoardPage.tsx` |
| filters.tsx (quick views, panel, chips, presets in localStorage, custom-field filters) | ported (`modules/crm/filters.tsx`) |
| cards.tsx (CardSetup, QuickEdit, fieldText) | ported (`modules/crm/cards.tsx`) |
| LeadCard.tsx (overlay card) | ported into Rombo's record page `LeadFormPage` (house style is a record page + chatter, not an overlay): sections, custom fields per section with ⚙, tags, duplicates + merge, lost picker with reasons, task types and quick due buttons, calls with recordings |
| Analytics.tsx + components/charts.tsx | ported (`modules/crm/AnalyticsPage.tsx`, hand-rolled SVG like uzbridge, tokens only) |
| Settings.tsx (pipelines, stages, fields, lost reasons, task types, distribution, connections) | ported (`modules/crm/SettingsPage.tsx`, connections in `modules/telephony/ConnectionsPanel.tsx`) |
| Telephony.tsx (CallLog, rules, people, Drive) | ported into Calls / Telefoniya settings |
| ai.tsx (AnalysisDrawer, AiSettingsCard) | not ported — no AI call analysis (user decision) |
| Softphone, CallPopup, Global, live | ported earlier; popup/board now on the socket |
| CrmApp.tsx, util.tsx, types.ts | folded into Rombo modules / api.ts |

### Outside crm, used by it
- notifications `crm_lead_assigned`, `crm_task_due` → Rombo has no notifications app: the same events are pushed
  over the socket (`{"type":"notify"}`) and shown as a toast with a link; the worker sends task-due reminders.
- Role scope "own" (uzbridge roles can limit a member to their own leads): not ported — Rombo's access model is
  page × CRUD without row scopes (a separate access-control change if wanted).

## 2. Decisions

### amoCRM = lead source (rejected: porting the add-on)
Porting uzbridge's amoCRM add-on would make Rombo push invoices/SMS/documents into amoCRM — modules Rombo does
not have. What a factory moving to Rombo needs from amoCRM is its leads. Kept from uzbridge: the manual-keys
OAuth, token refresh with a row lock, the v4 client (rate limit, retries), webhook subscription. Added: import
of deals with their main contact into Rombo leads (`IntakeLog` external id `deal:<id>`, stage matched by name,
142 → won, 143 → lost), on demand ("Tarixni olish"), every 10 min by the worker, and on the amoCRM webhook.

### Background work without Celery
uzbridge runs Celery + Redis beat. Rombo has neither; adding both for a single-company install is heavy.
Queue state already lives on the rows (a call's recording fields, a connection's `last_sync_at`), so
`manage.py crm_worker` polls them: every minute — recordings due, task-due
reminders, amoCRM token refresh; every 10 minutes — history sync of enabled connections. `--once` runs one pass
(cron / tests). Rejected: Celery (infra), threads in the web process (lost on restart).

### WebSockets on Channels
uzbridge: gunicorn (WSGI) + a separate uvicorn process subscribed to Redis. Rombo: one ASGI app (daphne).
`runserver` keeps working (daphne's runserver). In-memory channel layer by default (dev, one process);
`REDIS_URL` switches to channels-redis so `crm_worker` and `telegram_listen` can publish too. Auth: the JWT access
token in the query string (Rombo has no session cookie), checked with token_version; Origin must be an allowed
host. Rejected: keeping only polling (the user asked for parity).

### services package
The crm app's writes outgrew one file. `apps/crm/services/` is a package (`leads`, `extras`, `routing`,
`telephony`, `connections`, `intake`, `recordings`, `amocrm`) re-exported from `__init__`, so
`from apps.crm import services` keeps working. HTTP clients (no DB writes) live in `apps/crm/providers/`.

### Secrets
Fernet via `apps.core.crypto.EncryptedTextField`; key from env `FIELD_ENCRYPTION_KEY` (comma list = rotation).
DEBUG without a key derives one from SECRET_KEY (dev/tests only); production raises. Connection secrets are one
encrypted JSON blob; the API returns them masked (`••••••••abcd`) and only keys that are set; an empty value on
save keeps the stored one. External app credentials (Google OAuth client, Telegram api_id/hash) are env vars;
per-install keys (amoCRM client secret, PBX keys, Telegram sessions) are encrypted rows.

### Task types
uzbridge's task types are an editable list. Rombo's `LeadTask.kind` becomes free text holding the type name
(migration maps call/meeting/measure/message/other to Qo'ng'iroq/Uchrashuv/O'lchov/Xabar yozish/Boshqa); the list
lives in `CrmSettings.task_types`. Call-back tasks are found by their `call` link, not by type.

### Stage colours stay tones
Kept from add-crm-telephony (tokens, no hex). uzbridge's colour picker becomes a tone picker.

### Tests never touch the network
Every provider builds its httpx client through `providers.http.client()`; tests install an
`httpx.MockTransport`. Telethon is reached only through `apps.telegram.client.make_client`, replaced by a fake in
tests.

### No AI call analysis
The user decided against AI call analyzers (2026-10-29): no transcription, no review, no AI keys or settings,
no `anthropic` dependency. Analytics drop uzbridge's per-employee `ai_score` column. Recordings to Google Drive
stay (playback and archive only).
