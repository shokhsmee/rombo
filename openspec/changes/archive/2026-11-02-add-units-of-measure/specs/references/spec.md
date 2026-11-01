# references — delta

## ADDED Requirements

### Requirement: Units of measure registry
The system SHALL keep units of measure: a name, a category (count / length / area / weight / volume / other), a
ratio to the category's base unit, and aliases.
- Text resolves to a unit by name or alias, ignoring case, dots, spaces and ²: `шт`, `Шт.` and `ta` → `dona`.
- Units of one category convert by ratio; "other" units convert only to themselves.
- One spelling belongs to one unit.
- A unit used by products keeps its name, category and ratio.

#### Scenario: Alias resolves
- WHEN a product is saved with unit "кв.м"
- THEN it is stored as "m2"

#### Scenario: Spelling taken
- WHEN a new unit is saved with alias "шт"
- THEN 409 on `aliases` naming "dona"

#### Scenario: Used unit keeps its meaning
- WHEN the ratio of "m2" is changed while products use it
- THEN 409
