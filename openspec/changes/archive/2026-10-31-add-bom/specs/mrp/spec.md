# mrp — delta

## ADDED Requirements

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
