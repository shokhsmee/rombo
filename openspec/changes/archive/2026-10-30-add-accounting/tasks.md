# Tasks: add-accounting

## Backend
- [x] apps/accounting: models Account, AccountRole, JournalEntry, JournalLine (constraints, indexes),
      Invoice + InvoiceLine, ExchangeRate; codes BX / HF; TRACK on Invoice and Account
- [x] fixtures: `nsbu21.json` (accounts) + roles; `seed_accounting` command (idempotent)
- [x] company: `vat_payer`, `vat_code`, `vat_rate`, `lock_date` + migration
- [x] services: entry_post (balance check, lock date, rate lookup), entry_reverse, entry_create_manual,
      invoice_create/update/confirm/cancel (postings, advance offset, VAT rule), invoice_from_project,
      rate_set, fetch_cbu_rates command
- [x] selectors: account_balance, partner_balance, project_money, trial_balance, account_card,
      reconciliation
- [x] serializers + views + urls; registry pages accounting, accounts, invoices, accounting_reports;
      `CHATTER_PAGES` for invoice
- [x] projects: `GET /projects/{id}/` returns `money` from `project_money`; action `invoice` drafts a
      customer invoice
- [x] migrations: `makemigrations accounting -n initial`, `company -n vat_and_lock`
- [x] tests: unbalanced entry rejected; lock date; reversal; customer invoice posting with and without VAT
      payer; supplier invoice posting; advance offsets both sides; USD invoice at rate; fx difference on
      settlement; trial balance sums; reconciliation act totals; permissions

## Frontend
- [x] `src/modules/accounting/`: api.ts, JournalListPage + EntryPage (manual entry form, reverse),
      AccountsPage (tree, roles mapping), InvoicesListPage + InvoiceFormPage (confirm / cancel),
      ReportsPage (trial balance, account card, reconciliation) + print/ReconciliationPrint
- [x] Settings → Kompaniya: VAT block, lock date
- [x] Loyiha card: money block (invoiced / paid / debt), smart button "Hisob-fakturalar", button
      "Hisob-faktura chiqarish"
- [x] nav group Buxgalteriya

## Docs
- [x] project.md roadmap, archive, merge spec deltas, CHANGELOG, ADR 0007 referenced
