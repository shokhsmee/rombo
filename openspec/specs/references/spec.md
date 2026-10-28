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
