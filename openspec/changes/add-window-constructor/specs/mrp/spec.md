## ADDED Requirements

### Requirement: Materials from constructions
A Loyiha with constructions SHALL take its material need from the engine output instead of BOM explosion:
per mapped price-list item, the linked product, in its stock unit (bars × bar length for profiles kept in m,
m² for glass, pcs for hardware). Items without a linked product are listed as "Mahsulot bog'lanmagan".
"Freeze on confirm" applies unchanged.

#### Scenario: Profile in metres
- WHEN the cut plan needs 2 bars of "L -ka", the bar is 6.5 m and its product is kept in m
- THEN the Loyiha's need for that product is 13 m
