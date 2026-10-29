# Plan for review — Xaridlar · Buxgalteriya · Kassa (2026-10-30)

Three OpenSpec proposals, nothing implemented yet:

| Change | Folder | Depends on |
|---|---|---|
| Buxgalteriya (ledger, invoices, reports) | `openspec/changes/add-accounting` | — |
| Xaridlar (request → order → **send** → kirim) | `openspec/changes/add-procurement` | add-accounting |
| Kassa (kassa/bank accounts, PKO/RKO, balances) | `openspec/changes/add-kassa` | add-accounting |

Decisions that cut across apps: `docs/adr/0007-ledger-source-of-truth.md` (one ledger, postings only from
documents, accounts addressed by role, dependency direction) and `docs/adr/0008-one-partner-table.md`
(suppliers are clients of kind `supplier`).

Suggested order: accounting core (chart, roles, journal, lock date, rates) → procurement → kassa →
accounting invoices and reports. Procurement and kassa are independent of each other.

## Dependency direction
```
core ← access ← users ← employees ← clients ← projects ← accounting ← procurement / kassa / mrp / production
```
`accounting` knows clients, projects and company. It never imports procurement or kassa: a document is
referenced by `source_model` + `source_id`, like chatter does. Procurement and kassa never import each other.

## Documents and statuses

| App | Document | Code | Statuses | Posts to the ledger? |
|---|---|---|---|---|
| procurement | Xarid so'rovi (request) | XS-00001 | draft → submitted → approved / rejected → ordered; cancelled | no |
| procurement | Buyurtma (order) | XB-00001 | draft → **sent** → partially_received → received; cancelled | no |
| procurement | Kirim (goods receipt, carries the supplier's ESF №/date) | KR-00001 | draft → posted → cancelled | **yes** |
| accounting | Hisob-faktura (customer / supplier invoice) | HF-00001 | draft → confirmed → cancelled | **yes** |
| accounting | Jurnal o'tkazmasi (journal entry; manual only for opening balances / corrections) | BX-00001 | posted → reversed | is the ledger |
| kassa | Kirim / chiqim / o'tkazma (cash order) | PKO / RKO / BK / BT / OT-00001 | draft → posted → cancelled | **yes** |

"Cancelled" on a posted document always means: a mirror (reversing) entry is posted; nothing is edited or
deleted. A lock date on Company requisites closes past periods.

### The send step
`POST /procurement/orders/{id}/send/ {via: print | email | other, to}` → stores who / when / how, moves the
order to `sent`, writes "Yuborildi: email → sales@akfa.uz" to chatter, emails the printable order when
`via = email` (409 "Email sozlanmagan" if SMTP is not configured). Lines are locked after sending. The first
sent order of a confirmed Loyiha moves it to `procurement`.

## Postings (roles → seeded NSBU 21 accounts)

| Event | Entry |
|---|---|
| Prepayment to supplier (RKO / bank) | Dt 4310 advance_paid · Kt 5010 / 5110 |
| Goods receipt posted | Dt 1010 materials (net) · Dt 4410 vat_input · Kt 6010 ap_suppliers (gross); then Dt 6010 · Kt 4310 up to the prepayment |
| Supplier service invoice confirmed | Dt 9420 (or the line's role) · Dt 4410 · Kt 6010; same offset |
| Paying the supplier's debt | Dt 6010 · Kt 5110 / 5010 (any excess → Dt 4310) |
| Client advance (PKO / bank) | Dt 5010 / 5110 · Kt 6310 advance_received |
| Customer invoice confirmed | Dt 4010 ar_customers · Kt 9010 revenue (net) · Kt 6410 vat_output (12 %, only if `vat_payer`); then Dt 6310 · Kt 4010 up to the advance |
| Client pays the remainder | Dt 5010 / 5110 · Kt 4010 (excess → Kt 6310) |
| Expense, salary, employee advance, founder loan, tax | Dt 9420 / 6710 / 4220 / (Kt 6820) / 6410 · Kt cash |
| Transfer kassa → bank | Dt 5110 · Kt 5010 |
| USD document settled at another rate | difference → Dt 9620 fx_loss / Kt 9540 fx_gain on the partner |

Not in this plan (later changes): cost of goods sold and stock (`Dt 9110 Kt 2810` needs Sklad), payroll
calculation, depreciation, ESF exchange with didox / soliq.uz, bank statement import, returns to supplier.

## One source of truth
Every balance is a sum over posted journal lines: kassa and bank balances, supplier debt / prepayment,
client debt / advance, VAT, Loyiha paid / debt. Once a Loyiha has a posted customer payment, its
`advance_amount` and `advance_date` are derived from kassa (the same rule as `amount` from hisob-kitob).

## AKFA-style supplier flow, end to end
1. Request from the Loyiha's hisob-kitob → approved → order to AKFA in USD at today's rate → **sent** (print or email).
2. Prepayment from the bank: `Dt 4310 Kt 5110`.
3. Goods arrive with the ESF: Kirim posted at order prices, VAT 12 % to 4410, prepayment offset.
4. Remainder paid: `Dt 6010 Kt 5110`, with the exchange difference if the rate moved.
5. Month end: **solishtirma dalolatnoma** (reconciliation act) for AKFA from `accounting/reports/reconciliation/`, printable — opening balance, documents, closing balance.

## Open questions for the product owner
- Is Rombo a VAT payer (`vat_payer`)? If not, invoices carry no VAT and 4410 / 6410 are never hit.
- Are AKFA invoices in USD or in so'm at AKFA's own rate? (The order has currency + rate; the Central Bank
  rate is the default, the buyer can type AKFA's.)
- Who approves purchase requests — only the director, or buyers too (`purchase_approve` page per role)?
- Email for sending orders: do we have an SMTP account, or is print + Telegram enough for now?
- Should "Mijozlar" show suppliers in one list with a kind switch, or stay separate (proposal: separate page,
  same table)?

## Sources used for the accounting part
- NSBU 21, new edition: Order 191 of 14.11.2024, reg. 3593 of 27.12.2024, in force 01.01.2025
  (lex.uz/docs/7282759); NSFO 5 to replace it in 2026 (buxgalter.uz) → chart as data, roles in code.
- Supplier settlement postings (4310 / 6010 / 4410 / 6410 / 5110): buxgalter.uz, "Какими бухгалтерскими
  проводками отражаются расчеты с поставщиками и подрядчиками".
- VAT 12 % kept for 2026 (spot.uz budget message); input VAT on 4410, offset Dt 6410 Kt 4410 (buxgalter.uz).
- Cash: Central Bank instruction 714 (reg. 3003, 2018) sets the kassa limit with the bank; the cash book may
  be electronic.
- AKFA dealer terms (prepayment, USD price lists, reconciliation acts) could not be confirmed online —
  modelled from common Uzbek dealer practice; confirm with the buyer.
