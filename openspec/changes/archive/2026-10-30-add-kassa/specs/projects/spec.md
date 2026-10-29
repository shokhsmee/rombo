# projects — delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Payments on the card
The Loyiha detail SHALL return `payments: {count, paid, last_date}` and the card shows a smart button
"To'lovlar" (the Loyiha's cash orders) and a button "To'lov qo'shish" that opens a kirim pre-filled with
the client, the Loyiha and the remaining debt (needs `cash_orders.create`).

#### Scenario: Prefilled kirim
- WHEN "To'lov qo'shish" is used on a Loyiha with debt 7 500 000
- THEN the new order form has the client, the Loyiha, purpose "Mijozdan to'lov" and amount 7 500 000
