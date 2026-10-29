# Change: add-accounting  (status: proposed)

Implements ADR 0007. `add-procurement` and `add-kassa` depend on it; it depends on nothing new.

## Why
Rombo's books live in 1C at the accountant's desk, the ERP knows nothing about money beyond
`advance_amount` typed on the Loyiha. Suppliers (AKFA) work on prepayment and send a reconciliation act
(solishtirma dalolatnoma) every month; the sales side needs the client's debt per order; the director
wants cash in kassa and bank without phoning anyone. All of that is one thing: a ledger on the Uzbek chart
of accounts (NSBU 21, edition in force since 1 January 2025), filled **automatically** from documents.

## What changes
New app `apps/accounting`, page group **Buxgalteriya**:

- **Hisoblar rejasi** — chart of accounts seeded with the ~75 NSBU 21 accounts a window/door manufacturer
  uses (0130–0290 fixed assets, 1010–1090 materials, 2010/2510/2810/2910 production and goods, 4010/4310/
  4410/4890 receivables, 5010/5020/5110/5210/5510 cash and bank, 6010/6310/6410/6520/6710/6820/6990
  payables, 8330/8710 capital, 9010–9910 income and expenses). Accountant can add any other NSBU account.
- **Roles** (`AccountRole`): `cash_uzs → 5010`, `bank_uzs → 5110`, `ar_customers → 4010`,
  `ap_suppliers → 6010`, `advance_paid → 4310`, `advance_received → 6310`, `vat_input → 4410`,
  `vat_output → 6410`, `materials → 1010`, `revenue_products → 9010`, `fx_gain → 9540`… Posting rules speak
  in roles; the mapping is editable (settings).
- **Jurnal** — `JournalEntry` (`BX-00001`, date, memo, source document, posted/reversed) with balanced
  `JournalLine`s (account, debit, credit in UZS; partner, Loyiha, currency, amount in currency, rate).
  Immutable once posted; corrections are reversals. Manual entries (opening balances, corrections) need
  `accounting.create`.
- **Hisob-faktura** (`Invoice`, `HF-00001`): kind `customer | supplier`, partner, Loyiha, ESF number and
  date, currency and rate, lines with VAT rate. Confirming a **customer** invoice posts
  `Dt 4010  Kt 9010 (net) + Kt 6410 (VAT)` and offsets the client's advance (`Dt 6310 Kt 4010`);
  a **supplier** invoice posts `Dt <expense or asset role per line> + Dt 4410  Kt 6010` and offsets the
  prepayment. "Hisob-faktura chiqarish" on the Loyiha drafts a customer invoice from its lines.
- **Valyuta kurslari** — `ExchangeRate(date, currency, rate)`: manual entry plus `fetch_cbu_rates`
  (Central Bank JSON API). Documents in USD are posted in UZS at their date's rate; settlement differences
  go to `fx_gain` / `fx_loss`.
- **Lock date and VAT settings** on Company requisites: `vat_payer`, `vat_code`, `vat_rate` (12 %),
  `lock_date`. Posting on or before the lock date → 409.
- **Hisobotlar**: oborot-saldo vedomost (trial balance by account for a period), hisob kartochkasi (account
  card: lines of one account), **solishtirma dalolatnoma** (reconciliation act per partner for a period,
  printable), and the balances every other module shows: `partner_balance`, `account_balance`,
  `project_money` (invoiced / paid / debt per Loyiha).

Selectors are the public read API for other apps (`account_balance`, `partner_balance`,
`project_money`); `services.entry_post` / `entry_reverse` are the write API.

## Out of scope (own changes later)
Cost of goods sold and stock valuation (needs Sklad: `Dt 9110 Kt 2810` comes with the warehouse module);
payroll (6710 is only hit by kassa salary payments); fixed-asset depreciation; tax returns; ESF exchange
with didox / soliq.uz (ESF numbers are typed); multi-company.

## Impact
- New app `apps/accounting` (imports clients, projects, company). Tables: `accounting_account`,
  `accounting_accountrole`, `accounting_journalentry`, `accounting_journalline`, `accounting_invoice(+line)`,
  `accounting_exchangerate`.
- `company.Company`: `vat_payer`, `vat_code`, `vat_rate`, `lock_date`.
- Pages: `accounting` (journal; view, create = manual entry, update = reverse), `accounts` (chart + roles),
  `invoices`, `accounting_reports` (view only).
- Endpoints `/api/v1/accounting/`: `accounts/`, `roles/`, `entries/` (+ `reverse/`), `invoices/`
  (+ `confirm/ cancel/`), `rates/`, `reports/trial-balance/`, `reports/account-card/`,
  `reports/reconciliation/`, `balances/partner/{id}/`, `balances/project/{id}/`.
- Frontend `src/modules/accounting/`: journal list + entry page, chart of accounts page (tree, roles),
  invoices list + form, reports page, reconciliation print; Loyiha card: "Hisob-fakturalar" smart button and
  money block (invoiced / paid / debt from the ledger).
- Spec deltas: new `accounting`; `company` (VAT, lock date); `projects` (customer invoice, money block).
