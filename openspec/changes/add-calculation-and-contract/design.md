# Design: add-calculation-and-contract

## Price snapshot on the calculation
A calculation copies name, unit and price from the price list when created. Later price-list changes do
not move signed prices (the sample says "цена указана на дату предоставления коммерческого предложения").
"Narxlarni yangilash" re-reads current prices on demand, and is written to chatter.
Rejected: lines referencing price-list items live — every price change would silently re-price old orders.

## Rounding
Matches the sample exactly: line sum = ROUND_HALF_UP(qty × price, 0); total = Σ line sums.
(4.5 × 51.4 = 231.3 → 231; 2.5 × 80.2 = 200.5 → 201; total 1 080.)

## Amount is derived, not typed, once a calculation exists
Typing the amount next to a calculation is how the two drift apart. With calculations the service sets
`amount` itself after every calculation change and on `usd_rate` change. Without calculations the field
stays manual (small jobs, legacy orders).
Currency: price lists are in one currency (USD today). If the Loyiha is UZS and the calculations are USD,
`amount = round(Σ totals × usd_rate)`; a missing rate is a validation error.

## Calculation lines are the material list
Line `item` keeps a FK to the price-list item (nullable, SET_NULL) next to the snapshot. Purchasing and MRP
will group by it. This is why lines are rows, not a JSON blob.

## Print documents are rendered by the frontend
Invoice and contract are pages that read the same JSON as the card and use print CSS. Rejected for now:
server-side .docx — needs a template engine and Word for every tweak; PDF from the browser is what sales
sends today. If lawyers need an editable contract we add `.docx` export from the same data.

## Company requisites as a singleton row
One `Company` row (pk=1) edited in settings. Rejected: settings in env/code — the director or bank account
changes without a deploy.
