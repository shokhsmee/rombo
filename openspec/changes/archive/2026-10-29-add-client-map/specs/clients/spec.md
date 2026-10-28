# clients — delta

## ADDED Requirements

### Requirement: Client location
A client MAY have a point: `latitude` (−90…90) and `longitude` (−180…180), decimal with 6 places;
extra decimals are rounded. Both are set or both are empty. Changes are tracked in the client's history.

#### Scenario: Only one coordinate
- WHEN saving a client with `latitude` but no `longitude`
- THEN 400 on field `longitude`

#### Scenario: Out of range
- WHEN saving `latitude = 91`
- THEN 400 on field `latitude`

#### Scenario: Moving the pin is logged
- WHEN a client's point changes
- THEN its history shows the old and new "Kenglik" / "Uzunlik"

### Requirement: Client map
`GET /clients/map/` SHALL return `{items, total, without_point}`: every client with a point that matches
the list filters (`q`, `kind`, `segment`, `manager`, `region`, `is_active`), one light row each
(id, code, name, kind, phone, region, segment, manager, `lat`, `lng`, `active_projects`), unpaginated;
`without_point` counts matching clients that have no point. `active_projects` counts the client's
Loyihalar that are not delivered, closed or cancelled. Reading it requires `client_map` view **and**
`clients` view.

#### Scenario: Filtered map
- WHEN calling `/clients/map/?kind=dealer`
- THEN only dealers with a point are returned, and `without_point` counts dealers without one

#### Scenario: Map without client access
- WHEN a user has `client_map` view but not `clients` view
- THEN 403
