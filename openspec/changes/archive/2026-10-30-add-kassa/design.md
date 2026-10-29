# Design: add-kassa

## One document for cash and bank
`CashOrder` with `kind in | out | transfer` covers PKO, RKO, bank receipt, payment order and transfer.
The printed form and the number prefix depend on the account's kind and the direction; the data and the
posting rule are the same. Rejected: separate `CashReceipt`, `CashPayment`, `BankPayment`, `Transfer`
models — four list pages and four services for one table of fields.

Number prefixes: cash desk in / out `PKO` / `RKO`; bank in / out `BK` / `BT`; transfer `OT`. Each prefix
has its own sequence (`assign_code` with a per-prefix counter table), because PKO and RKO numbering is what
the cash book and the forms show.

## Purposes decide the posting
`PaymentPurpose(name, direction in|out|both, posting partner_customer | partner_supplier | account,
account_role, requires_partner, requires_employee, is_active)`. Posting on `cash_order_post`:

| posting | kirim (in) | chiqim (out) |
|---|---|---|
| partner_customer | Dt cash · Kt `ar_customers` up to the client's AR balance · Kt `advance_received` for the rest | refund: Dt `advance_received` (then `ar_customers`) · Kt cash |
| partner_supplier | refund: Dt cash · Kt `advance_paid` (then `ap_suppliers`) | Dt `ap_suppliers` up to the supplier's AP balance · Dt `advance_paid` for the rest · Kt cash |
| account | Dt cash · Kt `account_role` | Dt `account_role` · Kt cash |
| transfer (kind) | Dt to-account · Kt from-account | |

With an `invoice` set, the AR/AP amount is capped by that invoice's open amount instead of the partner's
whole balance (so a payment "for HF-00017" is traceable on the reconciliation act); the rest is still an
advance. Rejected: strict allocation of every payment to invoices (Odoo-style) — Rombo's clients pay
"avans" before any invoice exists; partner-level balances with optional invoice links are what the
accountant reconciles.

Seeded purposes: Mijozdan to'lov (in, partner_customer) · Mijozga qaytarish (out, partner_customer) ·
Yetkazib beruvchiga to'lov (out, partner_supplier) · Yetkazib beruvchidan qaytarish (in, partner_supplier)
· Xarajat (out, account `admin_expense`; editable per order to `selling_expense` / `other_op_expense`) ·
Ish haqi (out, `payroll`, employee) · Xodimga avans (out, `employee_advance`, employee) · Avans qaytarildi
(in, `employee_advance`, employee) · Ta'sischidan qarz (in, `founder_loan`) · Ta'sischiga qaytarish (out,
`founder_loan`) · Bank xizmati (out, `other_op_expense`) · Soliq to'lovi (out, `taxes_payable`) · Boshqa
kirim (in, `other_op_income`) · Boshqa chiqim (out, `other_op_expense`).

## Currency
An order is in its account's currency. A USD kassa order carries `amount` in USD and `rate` (default:
accounting rate of the day) and posts UZS = amount × rate with `amount_cur` on every line. Transfers between
currencies (USD kassa → UZS bank) are out of scope; the accountant does them as two orders through
`in_transit` for now (documented in the page help).

## No overdraft, no edits after posting
`cash_order_post` locks the account row (`select_for_update`), reads the ledger balance and refuses a chiqim
above it ("Kassada mablag' yetarli emas: qoldiq 1 250 000"). A posted order is immutable; `cancel` reverses
the entry (lock date applies). Draft orders can be edited and deleted. Rejected: allowing negative bank
balances "because the statement will come later" — the statement is a kirim; post it first.

## Loyiha advance becomes derived
When a Loyiha has at least one posted customer payment, `advance_amount` = Σ posted customer kirim −
Σ refunds for that Loyiha, converted to the Loyiha currency with each order's rate, and `advance_date` =
date of the first one; manual values are ignored (same pattern as `amount` from calculations). Without
payments both stay manual, so existing orders keep their numbers until Kassa goes live. Rejected: a big-bang
migration of old advances into PKOs — the accountant will enter opening balances in accounting instead.

## Cash book
`GET /kassa/book/?account&date` = opening balance (ledger at date − 1), the day's posted orders, totals,
closing balance. The optional `cash_limit` on a cash desk is only a warning on the page ("Limitdan oshdi") —
the limit is agreed with the bank yearly and is the kassir's responsibility, not a hard stop.
