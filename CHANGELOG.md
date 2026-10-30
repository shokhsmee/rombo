# Changelog

Newest first. Each entry: date · change-id (if any) · what · why (one line).

## 2026-10-31
- brand — The Rombo mark in the ERP (sidebar, login, favicon) is brand red (`--color-brand`, light and dark
  steps); the interface accent stays blue.
- brand — The Rombo mark from the company's printed documents (three squares + a slanted block, "фабрика
  сборки окон и дверей") replaces the generic blue diamond: sidebar, login page, favicon, every printed
  document (hisob-kitob, contract, purchase order, PKO / RKO, reconciliation act), README and docs. One
  source: `components/Brand.tsx` and `frontend/public/brand/`.
- fix(accounting) — Hisob-faktura totals (Summa / QQS / Jami / Avans hisobga olinadi) span the whole footer
  row, one line each with the currency, instead of wrapping inside the narrow sum column.
- `simplify-production-moves` — Loyiha card menu "Ishlab chiqarish" with three one-step dialogs:
  1) Materiallarni berish — all remaining materials listed with quantity = min(remaining, stock), ticked,
  editable, extra products addable, one button posts them all; 2) Tayyor mahsulotni qabul qilish — cost from
  the Loyiha's 2010 split by count; 3) Mijozga yetkazish — finished goods in stock pre-filled. Failed lines
  are listed, the rest go through. Why: issuing one product at a time through the move form was slow and
  unclear.
- fix(ui) — Picker lists (`EntitySelect`) open at page level, so a table, scroll box or dialog around the
  field no longer cuts them off; they open upwards when there is no room below. Why: on the Loyiha
  "Materiallar" table only the first product was visible.
- `add-bom`, `add-project-materials`, `add-mrp` — Ishlab chiqarish: BOMs (Tarkib, `BM-`) per finished or
  semi-finished product with per-piece / per-m² quantities and waste, multi-level explosion, cycle check,
  versions when a confirmed Loyiha uses the BOM, planned cost per piece and per m²; BOM-lines Excel import.
  Products get the `yarim` category and a purchase multiple. A Loyiha item points to a product; its
  Materiallar (need / issued / remaining / requested / stock) freeze on confirm and drive "BOM'dan
  hisob-kitobga", a product-linked purchase request and draft chiqim moves. The MRP page nets open needs
  against stock, open orders and requests, rounds to the purchase multiple, serves the earliest deadline
  first and creates purchase requests; dashboard shows the shortage count. New app `mrp` (ADR 0012).
  Why: quantities were typed by hand at every step and purchasing ignored stock.
- `add-dashboard-analytics` — Bosh sahifa shows one section per module the user may open: Savdo,
  CRM, Ta'minot, Moliya, Buxgalteriya, Ombor, Xodimlar — KPI tiles that open the filtered list, 12-month bar
  charts with tooltips, legend and a table view, and ranked lists (top clients and suppliers, stock by
  category, idle stock, lead stages, departments). `GET /dashboard/` reads the ledger and documents only.
  Why: the director answered "how are we doing" by opening six pages.
- `add-list-tools` — Every list page gets an Excel menu (export the filter or the selected rows), row
  checkboxes and a batch bar (post, delete drafts, submit, approve / reject, cancel with a reason, change
  Loyiha status, archive, (de)activate). Excel import with a template and a dry-run check for Loyihalar,
  Mijozlar, Yetkazib beruvchilar, Xodimlar, Mahsulotlar, Ombor harakatlari and kassa orders; each row goes
  through the list's serializer and service (ADR 0011). Qoldiqlar exports too. Why: Excel copies were
  retyped, and documents were posted one by one.
- `improve-product-selection` — Purchase lines can be linked to a warehouse product: typing a line name
  on the request or order suggests products with code, category and stock, and the link carries to the
  order and the KR. A draft KR shows where each line will post (chosen, from the order, found by name, or
  a new product with a category select), so a wrong category guess is fixed before posting. Chiqim,
  yetkazish and ko'chirish pickers list only what the chosen warehouse holds, with the quantity.
  Why: buyers could not pick the product they buy, and finished goods were hard to find for delivery.
- `add-inventory` — Ombor: every movement of stock is one row of one table (`StockMove`, `OM-`): kirim
  (written by posting a KR, into the receipt's warehouse), chiqim to a Loyiha (Dt 2010 Kt 1010), ishlab
  chiqarish (Dt 2810 Kt 2010, valued at the Loyiha's work in progress), yetkazish (Dt 9110 Kt 2810),
  ko'chirish between warehouses and tuzatish (surplus 9390 / shortage 9430). Stock on hand and value are
  sums over posted rows at weighted average cost; no negative stock; cancel = storno. Products (`MH-`,
  created by the first KR that brings them), warehouses, "Qoldiqlar" page, KPI row, Loyiha card "Ombor"
  button and actions, KR warehouse picker. Form rows no longer overflow with long picker values. ADR 0010.
  Why: one place where kirim, chiqim and yetkazish live with products and amounts, agreeing with 1010 / 2810.

## 2026-10-30
- `add-breadcrumb-trail` — Odoo-style breadcrumbs across apps: following links from a Loyiha to its
  request, order, money request and RKO keeps a clickable trail at the top; a crumb or browser back returns
  and shortens it; the pager swaps the last crumb; the sidebar starts over. Why: the way back was lost
  between apps.
- `add-purchase-approvals-and-money-requests` — Multi-level approval of purchase requests: ordered steps,
  each decided by members of a role (Sozlamalar → Tasdiqlash bosqichlari), every decision stored and shown on
  the request; no steps = the old single approval. Money requests (Pul so'rovi `PS-`) in kassa: the buyer
  asks from the order ("Pul so'rash"), kassa approves or rejects, "Pul berish" opens a linked RKO and the
  request becomes paid when posted chiqims reach the amount. A purchase order is sent only after kassa
  approves its money (409 otherwise). "Xaridga yuborish" on the Loyiha card drafts a request from its
  hisob-kitob. Kassa now sits under procurement (ADR 0009). Dialogs scroll inside and keep their buttons
  on screen. Why: control before money leaves, and one click from the order to purchasing.
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
