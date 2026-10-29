# Design: add-accounting

## Chart of accounts is data; code speaks in roles (ADR 0007)
`Account(code, name, kind ∈ asset|contra_asset|liability|equity|income|expense, parent, is_active,
allow_posting)` seeded from `fixtures/nsbu21.json`. `AccountRole(key, account)` seeded alongside; the
settings page lets the accountant remap. Every posting rule does `acc("ap_suppliers")`.
Why: NSBU 21 was re-issued in 2024 (reg. 3593, in force 2025-01-01) and NSFO 5 is scheduled to replace it
in 2026 with new numbering. Rejected: an enum of account numbers in `models.py` — a renumbering would be a
migration touching every rule.

Seeded roles → accounts:

| role | account | role | account |
|---|---|---|---|
| cash_uzs | 5010 | ar_customers | 4010 |
| cash_usd | 5020 | advance_received | 6310 |
| bank_uzs | 5110 | ap_suppliers | 6010 |
| bank_usd | 5210 | advance_paid | 4310 |
| in_transit | 5510 | vat_input | 4410 |
| materials | 1010 | vat_output | 6410 |
| components | 1020 | taxes_payable | 6410 |
| goods | 2910 | social_payable | 6520 |
| finished_goods | 2810 | payroll | 6710 |
| wip | 2010 | employee_advance | 4220 |
| revenue_products | 9010 | founder_loan | 6820 |
| revenue_services | 9030 | other_debtors | 4890 |
| cogs_products | 9110 | other_creditors | 6990 |
| selling_expense | 9410 | claims | 4860 |
| admin_expense | 9420 | fx_gain | 9540 |
| other_op_expense | 9430 | fx_loss | 9620 |
| other_op_income | 9390 | equity | 8330 |
| retained_earnings | 8710 | | |

## One journal, generic source
`JournalEntry(code BX-NNNNN, date, memo, source_model, source_id, source_kind ∈ document|manual|reversal,
status ∈ posted|reversed, reversed_by, posted_by, posted_at)`. `source_model` is a string like
`procurement.goodsreceipt` — same trick as chatter, so accounting never imports the apps that post to it.
Rejected: a GenericForeignKey — same thing with more magic; a FK per source app — reverses the dependency.

`JournalLine(entry, account, debit, credit, partner, project, currency, amount_cur, rate, memo)`.
Exactly one of debit/credit is non-zero; Σdebit = Σcredit per entry, checked in `entry_post` and by a DB
constraint on the entry totals. Indexes: `(account, date)`, `(partner, account)`, `(project, account)`.

## Immutability and reversal
A posted entry is never edited or deleted. `entry_reverse(entry)` posts a mirror entry (debits and credits
swapped, `source_kind = reversal`, memo "Storno BX-00012") and marks the original `reversed`. Documents that
cancel call it. Rejected: red storno (negative amounts) — the trial balance math is the same, and mirrors are
easier to read on the account card.

## Lock date
`Company.lock_date`: any `entry_post` or `entry_reverse` with `date <= lock_date` raises Conflict
"Davr yopilgan". Documents inherit the check through the service. Rejected: a periods table — one date is
what a small company's accountant actually uses; periods can grow out of it.

## Currency
Functional currency is UZS. A document in USD carries `currency`, `rate` (default: `ExchangeRate` of its
date, else 409 "Kurs kiritilmagan") and lines store both `amount_cur` and the UZS debit/credit.
Partner balance is reported in UZS (from the ledger) and in document currency (Σ `amount_cur` on the
partner's AR/AP/advance accounts). Settlement difference: when a payment or offset closes an amount
in currency, the UZS difference between the original line's rate and the payment's rate is posted
`Dt fx_loss` / `Kt fx_gain` on the partner — this is what makes the UZS partner balance reach zero when the
USD balance does. The Loyiha's `usd_rate` stays what it is (the contract's commercial rate); the accounting
rate is the Central Bank's.

## Invoices
`Invoice(code HF-NNNNN, kind customer|supplier, partner, project, date, external_number, external_date,
currency, rate, status draft|confirmed|cancelled, entry)` with `InvoiceLine(name, unit, qty, price,
vat_rate, role)` — `role` is used only on supplier invoices (which expense or asset the line hits; default
`admin_expense`). `confirm` posts; `cancel` reverses. A customer invoice is the sales ESF: the Loyiha button
drafts one from the order lines (or one line "Loyiha LY-26-00042 bo'yicha mahsulot" at the order amount) and
the accountant edits and confirms. VAT lines are posted only when `Company.vat_payer`; otherwise `vat_rate`
is forced to 0 — many small firms are on turnover tax. Rejected: generating the customer invoice on Loyiha
confirmation — the ESF date is a tax event the accountant chooses.

Advance offset is automatic on confirm: `min(gross, partner's advance balance)` moves
`Dt 6310 Kt 4010` (customer) or `Dt 6010 Kt 4310` (supplier) in the same entry. This is the AKFA pattern:
prepay → receive goods → the invoice eats the prepayment → pay the rest.

## Balances are selectors, not columns
`account_balance(account | role, on=date, partner=None, project=None, currency=None)`,
`partner_balance(partner)` → `{ar, advance_received, ap, advance_paid, net_uzs, net_cur}`,
`project_money(project)` → `{invoiced, paid, debt}` where `paid` = customer payments on the Loyiha
(4010 + 6310 credits by project) — this replaces the typed `advance_amount` once kassa exists (see
`add-kassa`). Rejected: cached balance columns — ADR 0007.

## Reports
Trial balance: per account, opening Dt/Kt, period turnover Dt/Kt, closing Dt/Kt, from the lines (one grouped
query). Account card: lines of one account for a period with running balance. Reconciliation act: for one
partner and period, opening balance, every document (invoice, receipt, payment, reversal) with Dt/Kt from
Rombo's side, closing balance, printable in the form suppliers exchange. Rejected for now: balance sheet
and P&L forms — the accountant files those from 1C until this ledger carries everything (payroll, assets).

## Opening balances
A manual entry dated the day before go-live, balanced against `equity`/`retained_earnings`, with partner
and project on the AR/AP lines. Documented in the settings page help text; no special screen.
