# Change: add-crm-full-parity

## Why
`add-crm-telephony` ported uzbridge's CRM core (voronka, lid card, tasks, conversion) and generic telephony.
The user asked for the rest of uzbridge's CRM, end to end: lead sources, provider telephony, recordings,
custom fields, merging, auto-assignment, bulk actions, analytics, live updates and Telegram.

## What changes
- **Secrets at rest**: `apps.core.crypto` (Fernet, env `FIELD_ENCRYPTION_KEY`); SIP passwords migrated to it;
  every new secret (provider keys, OAuth tokens, Telegram sessions) uses it.
- **Live updates**: Django Channels WebSocket `/ws/live/` (JWT), `apps.core.realtime.publish`; the board,
  lead card, call popup and Telegram refresh from pushes (polling stays as a slow fallback).
- **Connections** (`crm.Connection`, from uzbridge): telephony kinds UTeL, Moi Zvonki, generic IP-PBX and lead
  sources Sayt/forma (webhook), Yuboraman, amoCRM — catalog-driven settings, encrypted secrets, token webhook
  URLs, check / pull history / rotate URL. Existing PBX webhook token migrates into a PBX connection.
- **Provider telephony**: UTeL and Moi Zvonki webhooks + history sync, company-number learning, Moi Zvonki
  click-to-call per employee, generic REST history / originate; extended call rules (unknown number per
  direction, duplicate policy, pipeline/stage, responsible, title template, source, tags, popup, min duration).
- **Recordings → Google Drive** (OAuth, `drive.file`), retry schedule, signed streaming playback.
- **Not included, by the user's decision (2026-10-29): AI call analysis** (uzbridge's transcription + review).
- **Lead intake**: public `/api/v1/crm/hooks/leads/<token>/` for forms / Yuboraman (field recognition,
  Facebook `field_data`, dedupe by external id, routing); REST pull; amoCRM as a lead source (manual-keys
  OAuth, token refresh, deal + contact import, webhook re-sync).
- **CRM extras**: custom lead fields (deal / contact / extra), tags, lost reasons per pipeline, editable task
  types, card setup, duplicate detection + merge, auto-assignment (round robin / least open), bulk actions,
  client-side filters with quick views and saved presets, quick edit, CRM analytics (voronka + calls),
  assignment and task-due notifications.
- **Telegram** (new app `telegram`): employees' own Telegram accounts (Telethon, MTProto), chats page, new
  private chat → client and lead, listener process; message text is never stored.
- **Background work**: `manage.py crm_worker` (sync, recordings, amoCRM, reminders) and
  `manage.py telegram_listen`; no Celery.

## Impact
- Apps: `core` (crypto, realtime, consumers, asgi), `crm` (models, services package, providers, views),
  new `telegram`; `access` registry gets `telegram`; `chatter` unchanged.
- Tables: `crm_connection`, `crm_intakelog`, `crm_leadfield`, `crm_clientdata`, `crm_lostreason`,
  `crm_crmsettings`, `crm_googleaccount`, `telegram_account`, `telegram_chat`;
  new columns on `crm_lead`, `crm_leadtask`, `crm_call`, `crm_extension`, `crm_telephonysettings`.
- Packages (exact): cryptography 50.0.2, channels 4.3.2, daphne 4.2.3, channels-redis 4.3.0, httpx 0.28.1,
  telethon 1.45.0.
- Env: `FIELD_ENCRYPTION_KEY`, `REDIS_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TELEGRAM_API_ID`,
  `TELEGRAM_API_HASH`, `PUBLIC_BASE_URL` — all empty by default; the UI shows "ulanmagan" until filled.
- Run: `runserver` now serves WebSockets (daphne); production `daphne config.asgi:application` plus the two
  long-running commands (README).
