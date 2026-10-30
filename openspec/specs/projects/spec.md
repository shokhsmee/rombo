# projects (Loyihalar)

## Purpose
A Loyiha is one customer order and the hub of the ERP. Procurement, MRP, production, delivery and payments will reference it.

## Requirements

### Requirement: Header
A Loyiha SHALL have: auto code `LY-YY-NNNNN`; name; client (required); manager; object address; region; contract number/date; deadline; amount `Decimal(18,2) ≥ 0`; currency `UZS | USD`; notes.

#### Scenario: Code on create
- WHEN a Loyiha is created in 2026
- THEN its code is `LY-26-NNNNN` and its status is `draft`

### Requirement: Status workflow
Allowed moves SHALL be:

| From | To |
|---|---|
| draft | confirmed, cancelled |
| confirmed | procurement, production, draft, cancelled |
| procurement | production, cancelled |
| production | ready |
| ready | delivered |
| delivered | closed |
| cancelled | draft |
| closed | — |

`POST /projects/{id}/status/ {status, comment}`. Detail returns `allowed_statuses`. The row is locked
(`select_for_update`) during the check. The move `confirmed → procurement` is also made by the system when
the first purchase order holding the Loyiha's lines is sent (see `procurement`).

#### Scenario: Invalid jump
- WHEN draft → ready
- THEN 400 on field `status`

#### Scenario: Cancel needs a reason
- WHEN → cancelled without comment
- THEN 400 on field `comment`

#### Scenario: First order sent
- WHEN a `confirmed` Loyiha's lines are on an order that is sent
- THEN the Loyiha is `procurement`

### Requirement: History
Status and header changes SHALL be written to the record's chatter (see `chatter`). A status change is one
`track` message carrying the status change and, if given, the comment as its body.

#### Scenario: Cancel with reason
- WHEN a project is cancelled with comment "Mijoz rad etdi"
- THEN chatter has one message: body "Mijoz rad etdi", change Holat: <old> → Bekor qilindi

### Requirement: Header lock
From `procurement` on, only production fields SHALL be locked: client, name, lines, brand, product name,
mosquito net, dismantling (409 if changed). Money, phone, dates, location, partner, channel and notes stay
editable — advances and debt change while the order is in the factory.

#### Scenario: Advance in production
- WHEN a project in `production` gets a new advance amount
- THEN it is saved and tracked in chatter

#### Scenario: Lines in production
- WHEN a project in `production` gets new lines
- THEN 409

### Requirement: Order card fields
A project SHALL also hold the sales order card fields: sale date, service amount, advance amount, phone,
partner (client of kind dealer/partner), sales channel, brand and product name, location (map link or
coordinates), mosquito net, dismantling. `№ заказа` is the project code. Once the Loyiha has at least one
posted customer payment (kassa), `advance_amount` SHALL be derived — Σ posted customer kirim − refunds for
the Loyiha, in the Loyiha currency at each order's rate — and `advance_date` is the first payment's date;
sent values are ignored. Without payments both stay manual.

#### Scenario: Debt
- WHEN amount = 10 000 000, service = 1 500 000, advance = 4 000 000
- THEN `debt_amount` = 7 500 000 and `total_amount` = 11 500 000 (computed, never stored)

#### Scenario: Advance from payments
- WHEN two kirim of 3 000 000 and 1 000 000 are posted for the Loyiha
- THEN `advance_amount = 4 000 000`, `advance_date` = the first kirim's date, and a PATCH with
  `advance_amount = 9 000 000` leaves it at 4 000 000

### Requirement: Order lines
A project SHALL have lines `(product_type, area_m2 > 0, quantity ≥ 1)`. Saving `items` replaces all lines.
`total_area` and `total_quantity` are the sums. A line change is written to chatter.

#### Scenario: Lines totals
- WHEN lines are Termo 12.5 m² × 4 and PVX 8 m² × 3
- THEN total_area = 20.5 and total_quantity = 7

### Requirement: Hisob-kitob (calculation)
A Loyiha SHALL have calculations made from a price list. Creating one copies every active item's name, unit
and price (snapshot); users enter quantities and may adjust prices. Line sum = ROUND_HALF_UP(qty × price, 0);
total = Σ line sums. "Refresh prices" re-reads current price-list prices on request. Calculations lock with the
production fields. Changes are written to chatter.

#### Scenario: Sample sheet
- WHEN the 15 quantities of the sales sample sheet are entered on "Rombo Termo 306J 65 seriya"
- THEN the total is 1 080 (L-ka 4.5 × 51.4 → 231, Balkon T 2.5 × 80.2 → 201)

#### Scenario: Price list changed later
- WHEN a price-list price changes after a calculation was made
- THEN the calculation total is unchanged until "refresh prices"

### Requirement: Amount from calculations
When a Loyiha has calculations its `amount` SHALL be derived: the calculations' total in the Loyiha currency,
converted with `usd_rate` when they differ (so'm amounts rounded to whole so'm). A manually sent amount is
ignored. Without a needed rate the amount is left unchanged and the card warns.

#### Scenario: So'm order from a USD calculation
- WHEN the total is 1 080 USD and the rate is 12 000
- THEN amount = 12 960 000 so'm

### Requirement: Contract and invoice documents
The system SHALL print, from the same data: the hisob-kitob in the sales sheet's layout (lines, total, deal sum,
advance, remainder, advance date, deadline, customer, seller) and the sales contract from the company's sample
text, filled with the Loyiha (number, date, product spec block, sums in so'm with the USD equivalent), the client
(name, passport, address, phone) and the company requisites. Product spec fields on the Loyiha: profile colour,
door and window accessories, windowsill, glass, shotlandka; plus `advance_date` and `usd_rate`.

#### Scenario: Contract print
- WHEN `/print/projects/{id}/contract` is opened for a Loyiha with a client and company requisites
- THEN the contract text is filled with the Loyiha number, date, spec block, sums and both parties

### Requirement: Drawings
Users with `projects.update` SHALL upload files (pdf, images, dwg, dxf, zip; ≤ 25 MB) and delete them;
users with `projects.view` SHALL download them through the API, never a public URL. Uploads and deletes
go to chatter.

#### Scenario: Wrong type
- WHEN uploading `virus.exe`
- THEN 400 on field `file`

### Requirement: Delete only drafts
Only drafts SHALL be (soft) deleted; others must be cancelled.

#### Scenario: Delete a confirmed Loyiha
- WHEN DELETE on a `confirmed` Loyiha
- THEN 409

### Requirement: Search and filters
The list SHALL search code, name, contract number, object address, client name, client phone (every word must match). Filters: `status` (multi), `client`, `manager`, `currency`, `overdue`, `deadline_from/to`. `GET /projects/summary/` returns counts per status.

#### Scenario: Every word matches
- WHEN `q = "valiyev qidiruv"`
- THEN only Loyihalar matching both words (across name and client) are returned

### Requirement: Money from the ledger
The Loyiha detail SHALL return `money: {invoiced, paid, debt}` in so'm computed by
`accounting.project_money` (customer invoices confirmed, customer payments posted, invoiced − paid), plus
`currency` (the Loyiha's) and, when it is not so'm, `rate` (the Loyiha's `usd_rate`, else the accounting
rate of today) and `invoiced_cur`, `paid_cur`, `debt_cur` converted with that rate. The card shows the
figures in the Loyiha currency first with the so'm amount beside them; every money figure carries its
currency. A smart button "Hisob-fakturalar" opens the Loyiha's invoices; "Hisob-faktura chiqarish" drafts
one (needs `invoices.create`). "To'lov qo'shish" opens a kirim pre-filled in the Loyiha currency.

#### Scenario: Nothing posted yet
- WHEN a Loyiha has no invoices or payments
- THEN `money = {invoiced: 0, paid: 0, debt: 0}` and the card still shows the typed advance and debt

#### Scenario: Dollar order
- WHEN a USD Loyiha with `usd_rate` 11 935 has an invoice of 101 447 500 so'm and a payment of 30 000 000 so'm
- THEN `money.invoiced_cur = 8500.00`, `paid_cur = 2513.62`, `debt_cur = 5986.38`, and the card reads
  "8 500 USD · 101 447 500 so'm"

#### Scenario: Decimal money
- WHEN a figure is 5986.38 USD
- THEN it renders as "5 986,38 USD"

#### Scenario: Payment in the order currency
- WHEN "To'lov qo'shish" is used on a USD Loyiha and an active USD kassa exists
- THEN the kirim opens on that kassa with the USD debt; WHEN no USD account exists THEN it opens on the
  first so'm account with debt × rate and a note "USD kassa yo'q — so'mga o'girildi (kurs 11 935)"

### Requirement: Payments on the card
The Loyiha detail SHALL return `payments: {count, paid, last_date}` and the card shows a smart button
"To'lovlar" (the Loyiha's cash orders) and a button "To'lov qo'shish" that opens a kirim pre-filled with
the client, the Loyiha and the remaining debt (needs `cash_orders.create`).

#### Scenario: Prefilled kirim
- WHEN "To'lov qo'shish" is used on a Loyiha with debt 7 500 000
- THEN the new order form has the client, the Loyiha, purpose "Mijozdan to'lov" and amount 7 500 000

### Requirement: Procurement on the card
The Loyiha detail SHALL return `procurement: {requests, orders, received_pct}` (counts, and the share of
ordered quantity already received) and the card shows a smart button "Xaridlar" opening the requests and
orders filtered by the Loyiha.

#### Scenario: Smart button counts
- WHEN a Loyiha has one approved request and two orders, one fully received
- THEN `procurement = {requests: 1, orders: 2, received_pct: 50}`

### Requirement: Create the client from the Loyiha form
When the typed text in the Mijoz picker has no exact match, the picker SHALL offer "«<text>» yaratish"
(creates an individual client with that name and selects it) and "Yaratish va to'ldirish…" (opens a dialog
with kind, name, phone, region, address and STIR; saving creates the client and selects it). Both need
`clients.create`; without it the options are not shown.

#### Scenario: Quick create
- WHEN a user with `clients.create` types "Ali Valiyev" in the Mijoz field and picks "«Ali Valiyev» yaratish"
- THEN a client "Ali Valiyev" of kind individual exists and is selected on the form

#### Scenario: Create and edit
- WHEN the user picks "Yaratish va to'ldirish…", fills phone and region, and saves
- THEN the dialog closes and the new client is selected; a validation error (name too short) is shown in the dialog

#### Scenario: No permission
- WHEN a user without `clients.create` types an unknown name
- THEN only "Topilmadi" is shown
