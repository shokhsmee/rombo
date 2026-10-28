# references — delta

## ADDED Requirements

### Requirement: Editable lists
The system SHALL keep admin-editable lists of kind `sales_channel`, `product_type`, `brand`,
`client_segment`: name (unique per kind), sort order, active flag. Inactive items stay on old records
but are not offered for new ones.

### Requirement: Access
Any logged-in user SHALL read the lists (they fill pickers). Creating, editing and deleting need the
`references` page permission. An item used by a record cannot be deleted — deactivate it.

#### Scenario: Delete used item
- WHEN deleting a sales channel used by a project
- THEN 409
