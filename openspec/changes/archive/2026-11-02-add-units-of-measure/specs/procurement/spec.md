# procurement — delta

## ADDED Requirements

### Requirement: Receipts convert to stock units
Posting a goods receipt SHALL convert each line from its unit to the product's stock unit:
- the same unit as is;
- the purchase unit × factor;
- otherwise the registry ratio within one category.

A unit that doesn't convert refuses the posting with 400, naming the product and both units.

#### Scenario: Bars into metres
- WHEN 10 "шт" of a profile kept in m with "1 dona = 6.5 m" are received at 390 000 so'm each
- THEN stock rises by 65 m at an average cost of 60 000 so'm per m

#### Scenario: Unit that doesn't convert
- WHEN 3 "kg" of a product kept in dona are received
- THEN 400 naming «kg»
