# projects — delta

## MODIFIED Requirements

### Requirement: Money from the ledger
The Loyiha detail SHALL return `money: {invoiced, paid, debt}` in so'm computed by
`accounting.project_money` (customer invoices confirmed, customer payments posted, invoiced − paid), plus
`currency` (the Loyiha's) and, when it is not so'm, `rate` (the Loyiha's `usd_rate`, else the accounting
rate of today) and `invoiced_cur`, `paid_cur`, `debt_cur` converted with that rate. The card shows the
figures in the Loyiha currency first with the so'm amount beside them; every money figure carries its
currency. A smart button "Hisob-fakturalar" opens the Loyiha's invoices; "Hisob-faktura chiqarish" drafts
one (needs `invoices.create`). "To'lov qo'shish" opens a kirim pre-filled in the Loyiha currency.

#### Scenario: Nothing posted yet
- WHEN a Loyiha has no invoices or payments
- THEN `money = {invoiced: 0, paid: 0, debt: 0}` and the card still shows the typed advance and debt

#### Scenario: Dollar order
- WHEN a USD Loyiha with `usd_rate` 11 935 has an invoice of 101 447 500 so'm and a payment of 30 000 000 so'm
- THEN `money.invoiced_cur = 8500.00`, `paid_cur = 2513.62`, `debt_cur = 5986.38`, and the card reads
  "8 500 USD · 101 447 500 so'm"

#### Scenario: Decimal money
- WHEN a figure is 5986.38 USD
- THEN it renders as "5 986,38 USD"

#### Scenario: Payment in the order currency
- WHEN "To'lov qo'shish" is used on a USD Loyiha and an active USD kassa exists
- THEN the kirim opens on that kassa with the USD debt; WHEN no USD account exists THEN it opens on the
  first so'm account with debt × rate and a note "USD kassa yo'q — so'mga o'girildi (kurs 11 935)"
