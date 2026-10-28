# Design: add-crm-telephony

Source: uzbridge `backend/crm/` (models, services, telephony, routing, normalize, phones, hooks_api) and
`frontend/src/crm/` (Board, LeadCard, Telephony, Softphone, CallPopup, live).

## What was ported, what was not

| uzbridge | Rombo | Why |
|---|---|---|
| `Pipeline`, `Stage` (won/lost terminal stages) | ported | the core of the voronka |
| `Lead` | ported, Rombo fields | manager is a Xodim (Rombo's convention), source is the existing `sales_channel` list |
| `LeadEvent` (note / task / call / stage / created) | split: notes, stage changes, calls → **chatter**; tasks → `LeadTask` | Rombo already has one history per record; a second feed would duplicate it |
| `Call`, `Extension` | ported | the telephony core |
| `normalize.py` generic PBX reader, `phones.py` | ported (generic part) | any Asterisk-style PBX can post events |
| `routing.py` (number → customer → open lead) | ported, simplified | an unknown number becomes a **lead with a phone**, not a client: clients are created only on conversion |
| `CrmSettings.telephony` rules | `TelephonySettings` row: create lead for unknown incoming / missed, call-back task and its delay | single company → one row |
| `Softphone.tsx` (JsSIP), `CallPopup.tsx` | ported | browser phone + incoming call card |
| `company` FK everywhere, `request.company` scoping | **dropped** | Rombo is single-company |
| amoCRM import (`backend/amocrm`) | **skipped** | not used by Rombo |
| Telegram, Yuboraman / website-form lead sources (`intake.py`, `Connection` of kind webhook/yuboraman) | **skipped** | no such channel at Rombo yet; can be added as a lead webhook later |
| UTeL / Moi Zvonki specific clients (`utel.py`, `moizvonki.py`, `rest.py`), history sync, click-to-call through the provider REST API | **skipped** | provider-specific; Rombo's PBX is not chosen yet. The generic webhook covers any PBX that can POST events |
| Call recordings to Google Drive (`recordings.py`), AI call analysis (`analysis.py`) | **skipped** | external accounts and API costs; the call keeps the PBX `recording_url` and the log plays it |
| Custom lead fields (`LeadField`, `CustomerData`), card designer, duplicate merge, distribution widget, clinic / realty links, bulk actions, analytics page | **skipped** | uzbridge's multi-tenant extras; Rombo's lead has fixed fields. Board totals give the basic numbers |
| WebSocket live updates (`realtime_ws.py`) | **replaced by polling** | Rombo has no ASGI/Channels. The popup polls `/telephony/calls/live/` every 4 s, only for users with an extension |

## Lead → Mijoz → Loyiha
A lead is the *pre-sale* record (who called, what they want, measurement done?). It does not create a
Mijoz on its own — the client list stays clean of wrong numbers and spam.
`lead_convert` (one transaction):
1. client = the lead's linked client, else a client matched by phone, else `clients.services.client_create`
   (name = contact name or title, phone, region, address, manager, source text);
2. project = `projects.services.project_create(name, client, manager, phone, region, object_address,
   sales_channel = lead.source, amount = budget)`;
3. lead → the pipeline's won stage, `lead.client`, `lead.project` set; an event on the lead and on the project.
A lead already converted → 409. Dependency direction holds: crm imports clients/projects services;
they never import crm.

Rejected: creating the Mijoz when the lead is created (uzbridge does, via `sales.Customer`) — Rombo's
clients are a business list with STIR and segments, junk numbers would pollute it.

## Stage colours
uzbridge stores hex colours per stage. Rombo forbids raw hex in components, so a stage stores a **tone**
(`neutral|accent|info|warn|done|ok|bad`) mapped to the design tokens.

## Status vs stage
`status` (open/won/lost) is derived from the stage on every move (won stage → won …), kept as a column for
filters. Moving to a lost stage requires a reason (like cancelling a Loyiha). Won stage through a plain move is
allowed (some leads close without an order), conversion is the normal path.

## Telephony
- **Webhook**: `POST /api/v1/telephony/hook/<token>/`, no login; the random token in the settings row is the
  access (rotate it from settings). JSON object, list or form. At most 50 events per request.
- **Ingest**: upsert `Call` by `external_id`; a late "ringing" after the end is ignored; operator by
  extension; client / open lead by phone (last 9 digits). When the call ends (and is not internal) the rules
  run once (`processed`): link or create the lead, write the call to the lead's and the client's chatter,
  a call-back task for a missed one (unless one is open), close call-back tasks when an answered call follows.
- **Softphone**: JsSIP registers to the PBX's SIP-over-WebSocket address with the user's SIP login.
  It reports its own calls to `/telephony/softphone/` — ignored when a PBX webhook was received in the last
  two days (the PBX record is the one; two would duplicate).
- **Stale calls**: a call still "ringing/talking" 30 min later is closed by the live endpoint (missed / answered).

## Secrets
No credentials in git or settings files. The SIP WebSocket address and domain live in `TelephonySettings`
(defaults may come from env `TELEPHONY_SIP_WSS`, `TELEPHONY_SIP_DOMAIN`). A user's SIP password lives in
their `Extension` row, is **write-only** in the API and is returned only to that user by `/telephony/me/`
(the browser needs it to register). uzbridge encrypts it with its `EncryptedTextField`; Rombo has no
encryption helper yet — encrypting at rest is a follow-up (needs a key in env + `cryptography`).

## Permissions
- `crm`: pipelines, stages, leads, tasks. Stage editing needs `crm.update`.
- `telephony`: call log (view), linking/notes (update), extensions and settings (update).
- `/telephony/me/`, `/telephony/softphone/`, `/telephony/calls/live/` need `telephony.view` only.

## Call has no record page
`Call` is a log row (no `TRACK`, no soft delete): it is shown in the call log and written into the lead's and
client's chatter. `crm.lead` is added to `CHATTER_PAGES`.
