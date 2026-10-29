# projects — delta

## ADDED Requirements

### Requirement: Money from the ledger
The Loyiha detail SHALL return `money: {invoiced, paid, debt}` computed by `accounting.project_money`
(customer invoices confirmed, customer payments posted, invoiced − paid) and the card shows them next to
the typed amounts. A smart button "Hisob-fakturalar" opens the Loyiha's invoices; "Hisob-faktura chiqarish"
drafts one (needs `invoices.create`).

#### Scenario: Nothing posted yet
- WHEN a Loyiha has no invoices or payments
- THEN `money = {invoiced: 0, paid: 0, debt: 0}` and the card still shows the typed advance and debt
