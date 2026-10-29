# ADR 0007 — The ledger is the single source of truth for money; accounting sits under the operational apps

- Status: accepted
- Date: 2026-10-30
- Relates to: ADR 0002 (services), ADR 0004 (Loyiha as hub)

## Context
Three modules are coming that all touch money: Xaridlar (procurement), Buxgalteriya (accounting) and
Kassa (cash desks and bank accounts). Each could keep its own balances (supplier debt on the supplier
card, client advance on the Loyiha, cash on the kassa). That is how spreadsheets drift: three numbers
that should be equal and never are. Uzbek law also requires double-entry books on the national chart of
accounts (NSBU 21, new edition in force since 1 January 2025; NSFO 5 is planned to replace it in 2026).

## Decision
1. **One ledger.** `apps/accounting` keeps a double-entry journal (`JournalEntry` + `JournalLine`).
   Every balance the ERP shows — kassa balance, bank balance, supplier debt, client advance, Loyiha
   paid/debt, VAT — is **computed from posted journal lines**, never stored on the business record.
   (Same rule as `Project.debt_amount` and `amount` from calculations: derived, not typed.)
2. **Postings come only from documents.** A goods receipt, an invoice, a cash order *post* themselves
   through `accounting.services.entry_post(source=<document>, lines=[...])`. People never type Dt/Kt
   for business operations; the only hand-made entries are opening balances and accountant corrections,
   marked `source_kind = manual`.
3. **Accounts are data, addressed by role.** The chart of accounts is a seeded table, editable in
   settings. Code never contains an account number: posting rules reference **roles**
   (`ap_suppliers`, `vat_input`, `cash_uzs`, …) that an `AccountRole` row maps to an account.
   When NSFO 5 renumbers the chart, the accountant remaps roles; no deploy.
4. **Posted entries are immutable.** Fixing a mistake = reverse (a mirror entry linked to the original)
   and post again. A lock date blocks posting into closed periods.
5. **Dependency direction** (extends AGENTS.md §2):
   `core ← access ← users ← employees ← clients ← projects ← accounting ← procurement / kassa / mrp / production`.
   `accounting` imports `clients` (partner on a line), `projects` (Loyiha on a line) and `company`
   (VAT settings, lock date). It never imports the apps that post to it: a document is referenced
   generically by `source_model` + `source_id`, the way `chatter` references records.
   `procurement` and `kassa` import `accounting.services` for posting and `accounting.selectors` for
   balances. `kassa` and `procurement` never import each other: a supplier payment links to a partner
   and, optionally, to an `accounting.Invoice`, not to a purchase order.
6. **Functional currency is UZS.** Documents may be in USD (AKFA price lists); lines carry
   `currency`, `amount_cur` and `rate`, and are posted in UZS at the document-date rate from the
   accounting rate table. Settlement differences post to `fx_gain` / `fx_loss`.

## Rejected
- *Balances stored on records and updated by services* — fast to read, but every new money document
  must remember to update every balance; one missed path and the numbers disagree with the books.
- *Accounting as a reporting layer that reads documents* (no journal) — cannot do opening balances,
  corrections, VAT or the reconciliation act; the accountant would still keep 1C on the side.
- *Hard-coded account numbers in posting code* — the chart just changed (2025) and will change again (NSFO 5).
- *Procurement and kassa under accounting* (accounting imports them to read documents) — the hub app
  would then depend on every leaf; adding a module would touch accounting every time.

## Consequences
- Balance queries are sums over `JournalLine` (indexed by account, partner, project, date). Fine for
  years at Rombo's volume; materialised balances can be added later behind the same selectors.
- Every new money-bearing document needs a posting rule (a few lines) and a test that its entry balances.
- The frontend never computes money; it shows what the API derived.
