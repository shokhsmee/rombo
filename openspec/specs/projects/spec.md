# projects (Loyihalar)

## Purpose
A Loyiha is one customer order and the hub of the ERP. Procurement, MRP, production, delivery and payments will reference it.

## Requirements

### Requirement: Header
Auto code `LY-YY-NNNNN`; name; client (required); manager; object address; region; contract number/date; deadline; amount `Decimal(18,2) ≥ 0`; currency `UZS | USD`; notes.

### Requirement: Status workflow
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

`POST /projects/{id}/status/ {status, comment}`. Detail returns `allowed_statuses`. The row is locked (`select_for_update`) during the check.

#### Scenario: Invalid jump
- WHEN draft → ready
- THEN 400 on field `status`

#### Scenario: Cancel needs a reason
- WHEN → cancelled without comment
- THEN 400 on field `comment`

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
coordinates), mosquito net, dismantling. `№ заказа` is the project code.

#### Scenario: Debt
- WHEN amount = 10 000 000, service = 1 500 000, advance = 4 000 000
- THEN `debt_amount` = 7 500 000 and `total_amount` = 11 500 000 (computed, never stored)

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

### Requirement: Drawings
Users with `projects.update` SHALL upload files (pdf, images, dwg, dxf, zip; ≤ 25 MB) and delete them;
users with `projects.view` SHALL download them through the API, never a public URL. Uploads and deletes
go to chatter.

#### Scenario: Wrong type
- WHEN uploading `virus.exe`
- THEN 400 on field `file`

### Requirement: Delete only drafts
Only drafts are (soft) deleted; others must be cancelled.

### Requirement: Search and filters
Search code, name, contract number, object address, client name, client phone. Filters: `status` (multi), `client`, `manager`, `currency`, `overdue`, `deadline_from/to`. `GET /projects/summary/` returns counts per status.
