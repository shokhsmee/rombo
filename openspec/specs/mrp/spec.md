# mrp Specification

## Purpose
Bills of materials (Tarkib), the Loyiha's material list and the net-requirements plan (MRP); ADR 0012.

## Requirements

### Requirement: Bill of materials
A BOM SHALL belong to one product of category `tayyor` or `yarim`, have code `BM-NNNNN`, name, version, active
flag and lines (component product, qty > 0, basis `dona | m2`, waste % ≥ 0, note). A product has at most one
active BOM. A component cannot be the BOM's own product, directly or through other BOMs.

#### Scenario: Cycle refused
- WHEN steklopaket's BOM contains the window and the window's BOM contains the steklopaket
- THEN 400 "Tarkib o'zini o'z ichiga oladi"

#### Scenario: New version for a used BOM
- WHEN a BOM used by a confirmed Loyiha is edited
- THEN a new active version is created and the old one stays as it was, inactive

### Requirement: Explosion
Exploding (product, count, total area m²) SHALL return leaf components with quantity = qty × (count for
`dona`, the item's total area for `m2`) × (1 + waste / 100), summed per product, recursing through components that have an
active BOM.

#### Scenario: Four windows, 10 m² in total
- WHEN the window's BOM has profile 3.2 m per m² with 5 % waste and 1 handle per piece
- THEN the explosion gives profile 3.2 × 10 × 1.05 = 33.6 m and 4 handles

#### Scenario: Semi-finished component
- WHEN the window needs 0.9 m² of steklopaket per m² and the steklopaket's BOM needs 2 m² of glass per m² of
  steklopaket (component lines count per unit of the component)
- THEN the explosion lists glass, not the steklopaket

### Requirement: Planned cost
The BOM SHALL show planned cost per unit = Σ (component average cost, else default cost) × qty, recursive.

#### Scenario: Cost roll-up
- WHEN profile costs 45 000 per m and the BOM needs 3.2 m per m² for a 1 m² window
- THEN its planned cost includes 144 000 for profile

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

### Requirement: Net requirements
The MRP plan SHALL list per component product: need = Σ remaining materials of Loyihas in `confirmed`,
`procurement`, `production`, `ready`; stock = on hand in all active warehouses; on order = Σ remaining qty of
sent or partly received purchase-order lines linked to the product; shortage = max(need − stock − on order, 0)
rounded up to `order_multiple`.

#### Scenario: Stock and orders count
- WHEN two Loyihas need 40 m and 30 m of profile, 20 m is in stock and 26 m is on order, multiple 6.5 m
- THEN the shortage is 24 m, rounded up to 26 m (4 bars)

### Requirement: Purchase requests from shortages
Selected shortages SHALL become purchase requests, one per Loyiha, allocating the shortage to Loyihas by
earliest deadline, with product-linked lines.

#### Scenario: Earliest deadline first
- WHEN 10 m of a shortage remains and Loyiha A (deadline 05.11) and B (deadline 20.11) need it
- THEN A's request gets the quantity first
