# ADR 0008 — One contragent table: suppliers are Clients of kind `supplier`

- Status: accepted
- Date: 2026-10-30
- Relates to: ADR 0007 (ledger)

## Context
Procurement needs suppliers (AKFA, glass works, hardware dealers). Accounting needs a partner on
receivable/payable lines for both sides (4010 by customer, 6010 by supplier, 4310/6310 advances).
A dealer who buys windows from Rombo can also sell Rombo accessories: the same legal entity on both sides.

## Decision
`clients.Client` is the ERP's contragent table. `ClientKind` gains `supplier` ("Yetkazib beruvchi").
Supplier-specific fields live on the same row (bank account, bank, MFO, currency of their price list,
prepayment %, credit days). The "Yetkazib beruvchilar" page under Ta'minot is a filtered view of the
same table with those fields; "Mijozlar" hides suppliers by default. Accounting lines carry one FK,
`partner → clients.Client`.

## Rejected
- *Separate `procurement.Supplier`* — accounting would need two partner FKs or a generic one; requisites,
  TIN uniqueness and the map would be duplicated; a dealer-supplier would exist twice.
- *Renaming the app to `partners`* — pointless churn; `clients` keeps its name, the label on the page is
  what users see.

## Consequences
- `clients` stays below `projects` and `accounting` in the dependency order; nothing new to import.
- The client list filter `kind` gets a fourth value; TIN uniqueness now also protects supplier records.
