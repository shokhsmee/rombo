# Changelog

Newest first. Each entry: date · change-id (if any) · what · why (one line).

## 2026-10-29
- `add-crm-full-parity` — The rest of uzbridge's CRM: lead sources (website / ad forms, Yuboraman, amoCRM deals →
  leads), UTeL and Moi Zvonki (webhooks, history pull, Moi Zvonki click-to-call), call recordings copied to Google
  Drive, custom lead fields, tags, lost reasons per pipeline, editable task types, card setup, duplicates + merge,
  auto-assignment, bulk actions, board filters with presets, CRM and call analytics, notifications, live updates over
  WebSocket (Channels; `runserver` serves it), Telegram (employees' own accounts, chats, chat → client / lead),
  `crm_worker` and `telegram_listen` processes. Secrets in the DB are Fernet-encrypted (`FIELD_ENCRYPTION_KEY`; SIP
  passwords migrated). AI call analysis left out by the product owner's decision. Why: the user asked for uzbridge's
  CRM end to end.
- Fix: a Django `Http404` / `PermissionDenied` in an API view answered 500; now 404 / 403 in the error format.
- `add-calculation-and-contract` — Hisob-kitob on the Loyiha from price lists (Narxlar; Termo 306J seeded):
  snapshot prices, half-up line rounding (sample = 1 080), order amount derived from it with the USD rate.
  Printable hisob-kitob (sales sheet layout) and shartnoma (company sample text) to PDF. Company requisites,
  contract spec fields, client passport. Process map in docs/process-map.md.
  Why: the client's price comes from this sheet; one source for price, contract, and later the material list.
- `add-crm-telephony` — CRM ported from uzbridge: Voronka (kanban + list, editable stages), Lid card with
  tasks and chatter, "Loyiha ochish" turns a lead into a Mijoz + Loyiha. Telephony: PBX webhook (any
  IP-PBX), call log with stats, calls matched to leads/clients by number and written to their history, missed
  call → lead + call-back task, live call popup, browser softphone (JsSIP 3.10.1), per-user extensions.
  New "CRM" menu group. Why: leads and calls had no trace before the order; uzbridge already had it working.
- `add-client-map` — Clients have a map point (latitude/longitude, tracked in chatter); new CRM →
  "Mijozlar xaritasi" (`/crm/map`, page `client_map`): Leaflet + OSM opening on Samarqand, pins by kind or
  segment, grouped bubbles, popups with a link to the card, filters, list ↔ map in sync; `GET /clients/map/`.
  Client card gets a "Lokatsiya" pin picker that also reads pasted "lat, lng" / Google / Yandex / OSM links.
  Kind switch on the client card no longer widens the page at 375 px.
  Why: sales and installers plan visits by area; points come from Telegram links today.
- `add-loyiha-card-fields` — Loyiha card has every field of the sales order card: service/advance amounts
  with computed debt, sale date, phone, partner, sales channel, brand/product, location, mosquito net,
  dismantling, order lines (type · m² · count) with totals, drawings. Lock now covers only production fields.
  New Sozlamalar → Ma'lumotnomalar (channels, order types, brands, segments); client segment.
  Why: sales keeps the whole order in one card instead of Excel; MRP will read the lines.
- `add-chatter-and-uzbridge-design` — Chatter: every tracked record has a history (create, field changes,
  notes) with author and time; Loyiha status history moved into it (old rows migrated).
  Why: one place to answer "who changed what and why", same as uzbridge/Odoo.
- `add-chatter-and-uzbridge-design` — Frontend rebuilt on Tailwind v4 + lucide with uzbridge's tokens and
  kit; record pages get record pager, action bar with status track, smart buttons and a chatter column;
  light/dark theme. Why: first UI was too plain; uzbridge is the house style (ADR 0006).

## 2026-10-28
- `bootstrap-foundation` — Django + DRF backend: auth (JWT + revocation), roles × page CRUD
  permissions, users, employees, clients, Loyihalar with status workflow and history.
  Why: foundation for procurement and MRP; every document must hang off a Loyiha.
- `bootstrap-foundation` — React + Mantine frontend: login, permission-filtered navigation,
  list/form views with search and filters, role matrix, user access preview.
- Backend rebuilt from FastAPI prototype to Django + DRF. Why: product owner's choice; admin,
  migrations and conventions for a long-lived ERP (ADR 0001).
- Client name now requires ≥ 2 characters (found by tests).
