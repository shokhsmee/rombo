# Changelog

Newest first. Each entry: date · change-id (if any) · what · why (one line).

## 2026-10-30
- `fix-currency-display` — Money on a USD Loyiha reads in USD first: the Buxgalteriya block shows
  "8 500 USD · 101 447 500 so'm" (converted at the Loyiha's `usd_rate`, else today's rate; `project_money`
  returns `currency`, `rate`, `*_cur`), every figure carries its currency, and `fmtMoney` keeps the decimal
  comma ("5 986,38 USD" was rendered "5 986 38 USD"). "To'lov qo'shish" opens the kirim on an account in the
  Loyiha currency with the contract rate, or converts to so'm and says so. `seed_kassa` adds "Valyuta kassasi"
  (USD, 5020). Why: a dollar order next to so'm ledger figures read as two different debts.
- `add-quick-create-client` — Mijoz picker on the Loyiha form creates clients inline, Odoo-style: typing an
  unknown name offers "«name» yaratish" (bare individual client) and "Yaratish va to'ldirish…" (popup with
  kind, name, phone, region, address, STIR); the new client is selected and its phone copied. `EntitySelect`
  gained `onCreate` / `onCreateEdit` for any picker. Why: sales left the order form to create the caller.
- `add-kassa` — Moliya: kassa and bank accounts (`CashAccount`, balance = ledger balance), one cash-order
  document for PKO / RKO / bank kirim / payment orders / transfers (`PKO-`, `RKO-`, `BK-`, `BT-`, `OT-`
  sequences), seeded payment purposes that decide the posting (customer → 4010 then 6310, supplier → 6010
  then 4310, expenses, salary, employee advance, founder loan, taxes), no overdraft, cancel = reversal,
  cash book per account and day, printable PKO / RKO forms. Loyiha `advance_amount` / `advance_date` are
  derived from posted customer payments once there is one; card gets "To'lovlar" and "To'lov qo'shish".
  Pages `kassa`, `cash_orders`, `cash_book`; role "Kassir". Why: money for orders was a typed number;
  now every so'm in and out is a document and a posting.
- `add-procurement` — Ta'minot: suppliers are clients of kind `supplier` with bank requisites and purchase
  terms (ADR 0008); purchase request `XS-` (from the hisob-kitob; submit → approve / reject, auto-approve for
  approvers), purchase order `XB-` per supplier with USD/UZS prices and rate, **send** step (print / email /
  other, who-when-how in chatter, lines locked after sending, first send moves a confirmed Loyiha to
  `procurement`), goods receipt `KR-` with partial receipts that posts `Dt 1010 / Dt 4410  Kt 6010` and eats
  the prepayment; order print page; Loyiha card "Xaridlar" block. Pages `procurement`, `purchase_approve`,
  `purchase_orders`, `goods_receipts`, `suppliers`. Why: AKFA orders lived in Excel and Telegram.
- `add-accounting` — Buxgalteriya: double-entry ledger on the NSBU 21 chart of accounts (seeded subset,
  accounts addressed by roles so a renumbering is a settings change — ADR 0007), immutable journal entries
  `BX-` with reversals, lock date and VAT settings on Company, exchange rates (manual + `fetch_cbu_rates`),
  customer / supplier invoices `HF-` posting revenue / expenses with VAT and automatic advance offsets,
  FX differences on settlement, reports (trial balance, account card, solishtirma dalolatnoma with print),
  balances as selectors for every other module, Loyiha money block and "Hisob-faktura chiqarish".
  Pages `accounting`, `accounts`, `invoices`, `accounting_reports`; role "Buxgalter".
  Why: one source of truth for every balance the ERP shows; the accountant stops keeping 1C on the side.
- Leaf apps add blocks to the Loyiha detail through `projects/extensions.register_detail_block` from their
  `AppConfig.ready()`, so `projects` never imports them (ADR 0004).
- `projects` and `clients` specs: requirements without scenarios got one (archive validation).

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
