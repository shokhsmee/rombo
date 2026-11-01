# references (Ma'lumotnomalar)

## Purpose
Short admin-edited lists behind pickers: sales channels, product (order) types, brands, client segments.
Implementation: `apps/references` (`RefItem`), page key `references`.

## Requirements

### Requirement: Editable lists
The system SHALL keep admin-editable lists of kind `sales_channel`, `product_type`, `brand`,
`client_segment`: name (unique per kind), sort order, active flag. Inactive items stay on old records
but are not offered for new ones. Defaults are seeded by migration.

### Requirement: Access
Any logged-in user SHALL read the lists (they fill pickers). Creating, editing and deleting need the
`references` page permission. An item used by a record cannot be deleted — deactivate it.

#### Scenario: Delete used item
- WHEN deleting a sales channel used by a project
- THEN 409

#### Scenario: Duplicate name
- WHEN adding "Akfa" to brands a second time
- THEN 409 on field `name`


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
