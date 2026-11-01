# mrp — delta

## MODIFIED Requirements

### Requirement: Net requirements in stock units
Open order and request lines SHALL count in the product's stock unit. A shortage SHALL round up to whole
purchase units; the plan shows "to buy" in both units.

#### Scenario: Bars
- WHEN profile kept in m (1 dona = 6.5 m) is 7 m short
- THEN "to buy" is 13 m = 2 dona

### Requirement: Requests ask in purchase units
Requests created from MRP SHALL ask in the product's purchase unit, in whole units.
- Across Loyihas, each one gets the bars its running total crosses, so together they ask for exactly "to buy".

#### Scenario: Two Loyihas share bars
- WHEN Loyiha A is short 4 m and Loyiha B 3 m of 6.5 m bars
- THEN A asks 1 dona and B asks 1 dona, 2 in all
