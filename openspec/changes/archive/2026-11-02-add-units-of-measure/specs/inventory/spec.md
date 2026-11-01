# inventory — delta

## ADDED Requirements

### Requirement: Product units
A product's stock unit SHALL be a registered unit, stored by its canonical name; an unknown unit is refused with
400 on `unit`.
- It can't change once the product has posted moves (409).
- A product may have a purchase unit with a factor ("1 dona = 6.5 m"). The factor is required unless the registry
  converts the two units.

#### Scenario: Unit locked by stock
- WHEN the unit of a product with posted moves is changed
- THEN 409 on `unit`

## MODIFIED Requirements

### Requirement: Purchase multiple
"Xarid karrasi" is replaced by the purchase unit and factor; existing multiples become "1 dona = <multiple>".
