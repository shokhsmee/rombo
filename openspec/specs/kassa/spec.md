# kassa Specification

## Purpose
TBD - created by archiving change add-kassa. Update Purpose after archive.

## Requirements

### Requirement: Cash account
A cash account SHALL have name, kind `cash | bank`, currency `UZS | USD`, ledger account (a 5xxx account
with `allow_posting`; default by kind and currency from the roles), bank name / MFO / account number for
banks, responsible employee, optional `cash_limit`, active flag. `GET /kassa/accounts/` returns each with
`balance` (account currency) and `balance_uzs` from the ledger; `GET /kassa/summary/` returns the totals.
An account with posted orders cannot be deleted, only deactivated.

#### Scenario: Balance is the ledger
- WHEN a kassa has posted kirim 5 000 000 and chiqim 1 200 000
- THEN `balance = 3 800 000`, equal to the ledger balance of its account

### Requirement: Cash order
A cash order SHALL have kind `in | out | transfer`, date, account, `to_account` (transfer only),
`amount > 0` in the account currency, `rate` (foreign currency), purpose, partner, Loyiha, employee,
optional invoice, basis, `received_from` / `issued_to`, notes. Required partner / employee follow the
purpose. Changes go to chatter.

#### Scenario: Purpose needs a partner
- WHEN posting "Yetkazib beruvchiga to'lov" without a partner
- THEN 400 on field `partner`

### Requirement: Cash order numbering and statuses
Codes SHALL follow the form: `PKO` / `RKO` for cash-desk kirim / chiqim, `BK` / `BT` for bank kirim /
payment, `OT` for transfers, each `-NNNNN` with its own sequence. Statuses `draft → posted → cancelled`;
drafts are editable and deletable; a posted order is immutable.

#### Scenario: Numbering per form
- WHEN the first cash-desk kirim and the first bank payment are posted
- THEN they are `PKO-00001` and `BT-00001`

#### Scenario: Edit a posted order
- WHEN PATCH on a posted order
- THEN 409; the way to change it is `cancel` and a new order

### Requirement: Customer postings
A `partner_customer` kirim SHALL post Dt cash · Kt `ar_customers` up to the client's receivable (or the
chosen invoice's open amount) · Kt `advance_received` for the rest; a chiqim (refund) the mirror:
Dt `advance_received` then `ar_customers` · Kt cash. One entry per order, `source = kassa.cashorder`,
partner and Loyiha on every partner line.

#### Scenario: Client pays an advance
- WHEN a client with no receivable pays 5 000 000 for a Loyiha
- THEN Dt 5010 5 000 000 · Kt 6310 5 000 000, partner = client, project = Loyiha

#### Scenario: Client pays after the invoice
- WHEN the client owes 6 200 000 on 4010 and pays 8 000 000
- THEN Dt 5010 8 000 000 · Kt 4010 6 200 000 · Kt 6310 1 800 000

### Requirement: Supplier postings
A `partner_supplier` chiqim SHALL post Dt `ap_suppliers` up to the supplier's payable (or the chosen
invoice's open amount) · Dt `advance_paid` for the rest · Kt cash; a kirim (refund from the supplier)
the mirror: Dt cash · Kt `advance_paid` then `ap_suppliers`.

#### Scenario: Prepayment to AKFA
- WHEN a supplier with no payable is paid 10 000 000 from the bank
- THEN Dt 4310 10 000 000 · Kt 5110 10 000 000

#### Scenario: Paying the rest
- WHEN the supplier is owed 16 880 000 and 16 880 000 is paid
- THEN Dt 6010 16 880 000 · Kt 5110 16 880 000 and the supplier balance is 0

### Requirement: Account and transfer postings
Posting an order with an account purpose SHALL write `Dt cash · Kt <purpose account>` for kirim and
`Dt <purpose account> · Kt cash` for chiqim; a transfer SHALL write `Dt to-account · Kt from-account`.
Foreign-currency orders post UZS at the order's rate with `amount_cur` on every line.

#### Scenario: Salary from the kassa
- WHEN "Ish haqi" 3 000 000 to an employee is posted
- THEN Dt 6710 3 000 000 · Kt 5010 3 000 000

#### Scenario: Transfer to the bank
- WHEN 20 000 000 is moved from the kassa to the bank account
- THEN Dt 5110 · Kt 5010 20 000 000, and both balances move

#### Scenario: Dollar kassa
- WHEN 1 000 USD is received into the USD kassa at rate 12 000
- THEN Dt 5020 12 000 000 (amount_cur 1 000 USD) · Kt 6310 12 000 000

### Requirement: No overdraft
A chiqim or transfer SHALL be refused when the account's ledger balance is smaller than the amount; the
account row is locked during the check.

#### Scenario: Not enough cash
- WHEN the kassa holds 1 250 000 and a chiqim of 2 000 000 is posted
- THEN 409 "Kassada mablag' yetarli emas: qoldiq 1 250 000"

### Requirement: Cancel
`POST /kassa/orders/{id}/cancel/ {comment}` SHALL reverse the entry, mark the order `cancelled` and write
the comment to chatter. Lock date applies. A reversal that would overdraw the account (cancelling a kirim
already spent) SHALL be refused.

#### Scenario: Cancel a spent kirim
- WHEN a kirim of 5 000 000 is cancelled but the kassa now holds 1 000 000
- THEN 409

### Requirement: Cash book
`GET /kassa/book/?account&date` SHALL return opening balance, the day's posted orders (number, partner,
basis, in, out), totals and closing balance; the page warns when the closing balance exceeds
`cash_limit`. PKO / RKO and the cash book page are printable.

#### Scenario: Day totals
- WHEN a day has kirim 5 000 000 and chiqim 1 200 000 on an account that opened at 3 000 000
- THEN the book shows opening 3 000 000, in 5 000 000, out 1 200 000, closing 6 800 000

### Requirement: Access
The registry SHALL have pages `kassa` (accounts: view, create, update), `cash_orders` (view, create,
update = post / cancel, delete = drafts only), `cash_book` (view). Managers with `projects.update` but no kassa page see the
Loyiha's payments read-only.

#### Scenario: Manager posts
- WHEN a user without `cash_orders.update` posts an order
- THEN 403
