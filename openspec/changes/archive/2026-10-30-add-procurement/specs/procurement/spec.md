# procurement (Xaridlar) — delta

## ADDED Requirements

### Requirement: Supplier
A supplier SHALL be a client of kind `supplier` with optional bank account, bank, MFO, price-list currency
(`UZS | USD`), prepayment % and credit days. `GET /procurement/suppliers/` lists them with the ledger balance
(`balance_uzs`, `balance_cur`: positive = we owe, negative = prepaid). Reading needs `suppliers.view`.

#### Scenario: Balance from the ledger
- WHEN a supplier has a posted receipt of 10 000 000 and a posted payment of 4 000 000
- THEN the suppliers list shows `balance_uzs = 6 000 000`

### Requirement: Purchase request
A request SHALL have code `XS-NNNNN`, a Loyiha (required), requester, needed-by date, notes and lines
(`item` price-list item or null, `name`, `unit`, `qty > 0`, `note`, `ordered_qty`). "Hisob-kitobdan olish"
copies the lines of a chosen calculation with their quantities.

#### Scenario: From hisob-kitob
- WHEN "Hisob-kitobdan olish" is used with a calculation of 15 lines with quantities
- THEN the request gets 15 lines with the same items, units and quantities

### Requirement: Purchase request workflow
Allowed moves SHALL be:

| From | To |
|---|---|
| draft | submitted, cancelled |
| submitted | approved, rejected, draft |
| approved | ordered (derived), cancelled |
| rejected | draft |
| ordered | — |

Lines are editable only in `draft`. `reject` needs a comment. Changes go to chatter.

#### Scenario: Submit by an approver
- WHEN a user holding `purchase_approve.update` submits a draft
- THEN the request is `approved` at once and chatter shows "Tasdiqlandi"

#### Scenario: Submit by a buyer
- WHEN a user without `purchase_approve` submits a draft
- THEN the request is `submitted` and approvers see it under the `needs_approval` filter

#### Scenario: Reject without reason
- WHEN rejecting without a comment
- THEN 400 on field `comment`

#### Scenario: Fully ordered
- WHEN every line's `ordered_qty` reaches `qty`
- THEN the request becomes `ordered`

### Requirement: Purchase order
An order SHALL have code `XB-NNNNN`, supplier (client of kind supplier), optional Loyiha, currency, rate
(default: accounting rate of the order date; required when currency ≠ UZS), expected date, notes and lines
(`request_line` or null, `item`, `name`, `unit`, `qty > 0`, `price ≥ 0`, `vat_rate`, `received_qty`).
Totals `net`, `vat`, `gross` in the order currency and in UZS.

#### Scenario: Totals in two currencies
- WHEN an order of 100 × 20 USD, VAT 12 %, has rate 12 000
- THEN `gross = 2 240 USD` and `gross_uzs = 26 880 000`

### Requirement: Order from requests
"Buyurtma yaratish" from one or more approved requests SHALL make one draft order per chosen supplier,
raise `ordered_qty` on the request lines, and default each line price to the last posted receipt price for
that supplier and item.

#### Scenario: Two suppliers from one request
- WHEN an approved request's profile lines are assigned to AKFA and its glass lines to another supplier
- THEN two draft orders are created and the request lines' `ordered_qty` equal their `qty`

### Requirement: Purchase order workflow
Allowed moves SHALL be:

| From | To |
|---|---|
| draft | sent, cancelled |
| sent | partially_received (derived), received (derived), cancelled |
| partially_received | received (derived) |
| received | — |
| cancelled | — |

#### Scenario: Lines locked after sending
- WHEN a line is changed on an order in `sent`
- THEN 409 "Yuborilgan buyurtma o'zgartirilmaydi — bekor qilib yangisini oching"

#### Scenario: Cancel after a receipt
- WHEN cancelling an order with a posted receipt
- THEN 409

#### Scenario: Order status follows receipts
- WHEN 60 of 100 bars are received
- THEN the order is `partially_received`; WHEN the remaining 40 arrive THEN it is `received`

### Requirement: Send to supplier
`POST /procurement/orders/{id}/send/ {via: print | email | other, to?, note?}` SHALL require at least one
line and a supplier, set `sent_at`, `sent_by`, `sent_via`, `sent_to`, move `draft → sent` and write
"Yuborildi: <via> → <to>" to chatter. With `via = email` the printable order is emailed to `to` (default:
the supplier's email). A `sent` order MAY be sent again (status unchanged, new chatter line). Needs
`purchase_orders.update`.

#### Scenario: Email not configured
- WHEN `via = email` and no email backend is configured
- THEN 409 "Email sozlanmagan" and the order stays `draft`

#### Scenario: Print
- WHEN `via = print`
- THEN the order is `sent` and `/print/procurement/orders/{id}` renders it (Uzbek) with supplier, company
  requisites, lines, totals and VAT

#### Scenario: Loyiha moves to procurement
- WHEN the first order holding lines of a `confirmed` Loyiha is sent
- THEN that Loyiha becomes `procurement` with chatter "Holat: Tasdiqlangan → Xaridda"

### Requirement: Goods receipt
A receipt SHALL have code `KR-NNNNN`, order, supplier (from the order), date, storekeeper, supplier ESF
fields (`invoice_number`, `invoice_date`, `invoice_total`), notes and lines (`order_line`, `qty > 0`, price
copied from the order line, `vat_rate`). "Kirim qilish" on an order pre-fills the remaining quantities.
A line cannot receive more than the order line's remaining quantity. Statuses: `draft → posted`,
`posted → cancelled`.

#### Scenario: Over-receipt
- WHEN a receipt line's qty exceeds `ordered − received`
- THEN 400 on field `lines`

#### Scenario: Posting writes the ledger
- WHEN a receipt of 100 bars × 20 USD at rate 12 000, VAT 12 %, is posted
- THEN one journal entry: Dt 1010 24 000 000 · Dt 4410 2 880 000 · Kt 6010 26 880 000, partner = supplier,
  project = the line's Loyiha, and the order line's `received_qty` = 100

#### Scenario: Prepayment offset
- WHEN the supplier has a 4310 balance of 10 000 000 and a receipt of 26 880 000 is posted
- THEN the same entry also has Dt 6010 Kt 4310 10 000 000, and the supplier balance is 16 880 000

#### Scenario: Cancel a posted receipt
- WHEN a posted receipt is cancelled
- THEN a reversing entry is posted, `received_qty` is rolled back and the order status is derived again

#### Scenario: Closed period
- WHEN posting with a date on or before the accounting lock date
- THEN 409

### Requirement: Access
The registry SHALL have pages `procurement` (requests), `purchase_approve` (view, update),
`purchase_orders`, `goods_receipts`, `suppliers`. `approve` and `reject` map to `purchase_approve.update`;
`send` and `cancel` to `purchase_orders.update`; `post` to `goods_receipts.update`.

#### Scenario: Buyer approves
- WHEN a user without `purchase_approve` calls `approve`
- THEN 403

### Requirement: Lists, search, history
Requests, orders and receipts SHALL be searchable by code, supplier, Loyiha code or name and line names;
filters `status` (multi), `supplier`, `project`, `date_from/to`, `needs_approval`. Every document is a
record page with chatter; TRACK covers status, supplier, project, dates and totals.

#### Scenario: Search by Loyiha
- WHEN searching orders with `q = LY-26-00042`
- THEN every order with a line of that Loyiha is returned
