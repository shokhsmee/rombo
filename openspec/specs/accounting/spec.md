# accounting Specification

## Purpose
TBD - created by archiving change add-accounting. Update Purpose after archive.

## Requirements

### Requirement: Chart of accounts
The system SHALL keep accounts (`code` 4 digits unique, `name`, `kind` asset | contra_asset | liability |
equity | income | expense, `parent`, `is_active`, `allow_posting`) seeded with the NSBU 21 subset a
window/door manufacturer needs, and roles (`key` unique → account) seeded for every role the posting rules
use. Accountants with `accounts.update` MAY add accounts and remap roles. An account with posted lines
cannot be deleted, only deactivated.

#### Scenario: Role remapped
- WHEN role `ap_suppliers` is remapped from 6010 to 6020
- THEN the next posted receipt credits 6020 and earlier entries are unchanged

#### Scenario: Used account deleted
- WHEN deleting an account that has journal lines
- THEN 409

### Requirement: Journal entry
A journal entry SHALL have code `BX-NNNNN`, date, memo, `source_model` + `source_id` (or none for manual),
`source_kind` document | manual | reversal, status posted | reversed, and at least two lines
(`account` with `allow_posting`, `debit` or `credit` > 0 but not both, optional `partner`, `project`,
`currency`, `amount_cur`, `rate`, `memo`). Σ debit SHALL equal Σ credit. A posted entry is immutable.

#### Scenario: Unbalanced entry
- WHEN posting lines Dt 1010 100 / Kt 6010 90
- THEN 400 "O'tkazma balanslanmagan" and nothing is written

#### Scenario: Manual entry
- WHEN a user with `accounting.create` posts a manual entry
- THEN it is stored with `source_kind = manual` and appears on the account cards

#### Scenario: Edit a posted entry
- WHEN PATCH on a posted entry
- THEN 405; the way to change it is `reverse`

### Requirement: Reversal
`POST /accounting/entries/{id}/reverse/ {date?, memo?}` SHALL post a mirror entry (`source_kind =
reversal`, debits and credits swapped, same partner / project / currency data) and mark the original
`reversed`. A reversed entry cannot be reversed again. Needs `accounting.update`.

#### Scenario: Reverse once
- WHEN reversing an already reversed entry
- THEN 409

### Requirement: Lock date
Posting or reversing with a date on or before `Company.lock_date` SHALL be refused.

#### Scenario: Closed month
- WHEN lock date is 2026-09-30 and a receipt dated 2026-09-15 is posted
- THEN 409 "Davr yopilgan"

### Requirement: Exchange rates
`ExchangeRate(date, currency, rate)` SHALL be unique per date and currency, editable with
`accounts.update`, and filled by the `fetch_cbu_rates` command from the Central Bank API. A document in a
foreign currency without a rate for its date and no rate given SHALL be refused.

#### Scenario: Missing rate
- WHEN confirming a USD invoice dated 2026-11-03 with no rate for that day and none on the document
- THEN 409 "Kurs kiritilmagan"

### Requirement: Currency posting
Lines of a foreign-currency document SHALL store `currency`, `amount_cur` and `rate`, with `debit`/`credit`
in UZS = `amount_cur × rate`. When a settlement (payment or advance offset) closes an amount in currency at
a different rate, the UZS difference SHALL be posted on the partner to `fx_gain` or `fx_loss` in the same
entry.

#### Scenario: Dollar invoice paid later
- WHEN a supplier invoice of 1 000 USD is posted at 12 000 and paid in full at 12 100
- THEN the payment entry has Dt 6010 12 000 000 · Dt 9620 100 000 · Kt 5110 12 100 000, and the supplier
  balance is 0 in both currencies

### Requirement: Invoice
An invoice SHALL have code `HF-NNNNN`, kind `customer | supplier`, partner, optional Loyiha, date,
`external_number` / `external_date` (ESF), currency, rate, notes and lines (`name`, `unit`, `qty > 0`,
`price ≥ 0`, `vat_rate`, `role` for supplier lines); totals `net`, `vat`, `gross`. Statuses: draft →
confirmed → cancelled. Lines are editable only in draft. Changes go to chatter.

#### Scenario: Customer invoice posted (VAT payer)
- WHEN a customer invoice of 10 000 000 net at 12 % is confirmed
- THEN one entry: Dt 4010 11 200 000 · Kt 9010 10 000 000 · Kt 6410 1 200 000, partner = client,
  project = Loyiha

#### Scenario: Customer invoice posted (not a VAT payer)
- WHEN `Company.vat_payer` is false
- THEN `vat_rate` is 0 on every line and the entry has no 6410 line

#### Scenario: Customer advance offset
- WHEN the client has a 6310 balance of 5 000 000 and an invoice of 11 200 000 is confirmed
- THEN the entry also has Dt 6310 Kt 4010 5 000 000 and the client's debt is 6 200 000

#### Scenario: Supplier service invoice
- WHEN a supplier invoice line "Yetkazib berish" 500 000 + 12 % with role `admin_expense` is confirmed
- THEN Dt 9420 500 000 · Dt 4410 60 000 · Kt 6010 560 000

#### Scenario: Cancel confirmed invoice
- WHEN a confirmed invoice is cancelled
- THEN its entry is reversed and the invoice is `cancelled`

### Requirement: Invoice from Loyiha
`POST /projects/{id}/invoice/` SHALL draft a customer invoice for the Loyiha's client: one line per order
line (product type, m², count) priced from the Loyiha amount, or one line at the order amount when there
are no lines; currency and rate from the Loyiha. Needs `invoices.create`.

#### Scenario: Draft from order
- WHEN called on a Loyiha of 12 960 000 so'm with two lines
- THEN a draft invoice with two lines totalling 12 960 000 opens for editing

### Requirement: Balances
Selectors SHALL compute, from posted lines only: `account_balance(account or role, on, partner, project)`;
`partner_balance(partner)` → `{ar, advance_received, ap, advance_paid, net_uzs, net_cur}`;
`project_money(project)` → `{invoiced, paid, debt}`. `GET /accounting/balances/partner/{id}/` and
`/balances/project/{id}/` expose them. No balance is stored on a record.

#### Scenario: Reversed entries do not count
- WHEN a receipt is posted and then cancelled
- THEN the supplier's balance is what it was before the receipt

### Requirement: Reports
`GET /accounting/reports/trial-balance/?from&to` SHALL return per account: opening Dt/Kt, turnover Dt/Kt,
closing Dt/Kt, with totals balanced. `reports/account-card/?account&from&to&partner&project` SHALL list
the lines with a running balance. `reports/reconciliation/?partner&from&to` SHALL return the solishtirma
dalolatnoma: opening balance, documents in order (date, document, Dt, Kt), closing balance, printable at
`/print/accounting/reconciliation`. Need `accounting_reports.view`.

#### Scenario: Trial balance balances
- WHEN any period is requested
- THEN Σ closing Dt = Σ closing Kt across accounts

#### Scenario: Reconciliation with AKFA
- WHEN a supplier had prepayment 10 000 000, receipt 26 880 000 and payment 16 880 000 in the period
- THEN the act lists the three documents and closes at 0

### Requirement: Access
The registry SHALL have pages `accounting` (journal: view, create = manual entry, update = reverse),
`accounts` (chart, roles, rates), `invoices`, `accounting_reports` (view). Documents of other apps post through services without
needing these pages; a storekeeper posting a receipt needs only `goods_receipts.update`.

#### Scenario: Storekeeper posts
- WHEN a user with `goods_receipts.update` and no accounting pages posts a receipt
- THEN the entry is written

#### Scenario: Manager reads the journal
- WHEN a user without `accounting.view` lists entries
- THEN 403
