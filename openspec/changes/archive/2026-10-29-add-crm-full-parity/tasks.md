# Tasks: add-crm-full-parity

## Platform
- [x] `apps/core/crypto.py` (Fernet, FIELD_ENCRYPTION_KEY), SIP passwords migrated (crm 0002)
- [x] Channels + daphne: `/ws/live/` (JWT), `apps/core/realtime.publish`, Redis layer by env
- [x] Django Http404 / PermissionDenied in the API error format
- [x] `.env.example`, README run commands

## Backend (crm)
- [x] Models: Connection, IntakeLog, LeadField, ClientData, LostReason, CrmSettings, GoogleAccount; lead tags / custom;
      task type names; call connection + recording fields; extension connection; telephony rules (0003–0005)
- [x] Providers: http (mockable), rest, UTeL, Moi Zvonki, amoCRM, Google
- [x] Services package: leads, extras (duplicates, merge, distribution, bulk), routing, telephony, connections, intake,
      amoCRM, recordings, worker, live pushes
- [x] Analytics (voronka + calls)
- [x] Views / routes: settings, fields, lost reasons, merge, bulk, duplicates, analytics, connections, hooks, dial,
      recordings, Google callback, signed stream
- [x] Commands: crm_worker, crm_repair_utel; demo data
- [x] Tests (no network: fake transport)

## Backend (telegram)
- [x] Account / Chat, client (listener RPC or direct), ops, services, listener + telegram_listen, API, tests

## Frontend
- [x] Live socket + notifications; popup on the socket
- [x] Board: quick views, filters, presets, card setup, quick edit, duplicate-aware quick add, list + bulk
- [x] Lead page: fields by section, tags, duplicates + merge, lost reasons, task types, quick dues, reopen
- [x] CRM settings: voronka / stages / lost reasons, fields, task types + add-ons, distribution, lead sources
- [x] Analytics page (voronka, calls)
- [x] Telefoniya settings: connections, rules, extensions (Moi Zvonki key), Drive recordings; click-to-call
- [x] Telegram: chats, accounts, connect wizard
- [x] Heavy pages lazy-loaded

## Check
- [x] `uv run pytest`, `npx tsc -b && npx vite build`, pages in the browser on a fresh DB
- [x] Archive, specs merged, CHANGELOG
