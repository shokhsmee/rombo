# projects — delta

## MODIFIED Requirements

### Requirement: History
Status changes and header changes SHALL be written to the record's chatter (see `chatter` spec).
A status change is one `track` message containing the status change and, if given, the comment as
its body. `ProjectStatusLog` and the `history` field of the project payload are removed; existing
rows are copied into chatter by migration.

#### Scenario: Cancel with reason
- WHEN a project is cancelled with comment "Mijoz rad etdi"
- THEN chatter has one message: body "Mijoz rad etdi", change Holat: <old> → Bekor qilindi
