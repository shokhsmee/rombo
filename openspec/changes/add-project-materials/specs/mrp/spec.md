# mrp — delta (project materials)

## ADDED Requirements

### Requirement: Loyiha materials
A Loyiha SHALL list materials per component product: need (explosion of its items' products), issued (posted
issue moves of the Loyiha), remaining = need − issued, and stock on hand. Items without a product are listed
as "BOM yo'q".

#### Scenario: Materials of a draft follow the items
- WHEN a draft Loyiha's window item changes from 4 to 6 pieces
- THEN the need of every component grows by half

### Requirement: Freeze on confirm
When a Loyiha moves to `confirmed`, its materials SHALL be stored and stop following later BOM changes;
"Qayta hisoblash" re-explodes them only while nothing has been issued.

#### Scenario: BOM edit after confirm
- WHEN the window BOM changes after the Loyiha was confirmed
- THEN the Loyiha's materials stay as they were

### Requirement: Documents from materials
From the materials the Loyiha SHALL be able to: fill hisob-kitob quantities (matched by price-list item),
create a purchase request of the remaining quantities with product-linked lines, and create draft issue moves
of the remaining quantities.

#### Scenario: Chiqim drafts
- WHEN "Materiallarni chiqim qilish" runs for a Loyiha needing 33.6 m profile and 4 handles, none issued
- THEN two draft issue moves for that Loyiha exist with those quantities
