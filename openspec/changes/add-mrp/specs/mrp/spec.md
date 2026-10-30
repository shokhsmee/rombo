# mrp — delta (planning)

## ADDED Requirements

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
