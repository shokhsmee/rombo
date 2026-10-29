# clients

## Purpose
Buyers who place Loyihalar: individuals, companies, dealers.

## Requirements

### Requirement: Client record
A client SHALL have: auto code `MJ-NNNNN`; kind `individual | company | dealer | supplier`; name (≥ 2 chars); TIN (9–14 digits,
unique among active clients); contact person; two phones; email; region; address; location; source; notes;
active flag; manager (employee). Companies, dealers and suppliers MAY have bank account, bank name and MFO;
suppliers MAY have `price_currency` (`UZS | USD`), `prepay_percent` (0–100) and `credit_days`.
`GET /clients/` hides `supplier` unless `kind=supplier` is asked for.

#### Scenario: Duplicate TIN
- WHEN saving a client with an existing TIN
- THEN 409 on field `tin`

#### Scenario: Suppliers stay out of the sales list
- WHEN listing clients without a `kind` filter
- THEN suppliers are not returned; WHEN `kind=supplier` THEN only suppliers are

### Requirement: List and search
`GET /clients/` SHALL search code, name, TIN, contact, phones, region; filters `kind`, `region`, `is_active`, `manager`. Detail includes `projects_count`.

#### Scenario: Search by phone
- WHEN `q = 901112233`
- THEN clients whose phone contains it are returned

### Requirement: Passport
Individual clients MAY have a passport number; it SHALL be printed on the contract.

#### Scenario: Passport on the contract
- WHEN a client with passport `AA 1234567` has a Loyiha
- THEN the contract print shows that passport number

### Requirement: Segment
A client MAY have a segment from the `client_segment` list; it SHALL be shown on the client's orders.
The `dealer` kind is labelled "Diler / hamkor" and is the pool for a project's partner.

#### Scenario: Segment on the Loyiha
- WHEN a client with segment "VIP" has a Loyiha
- THEN the Loyiha detail returns `client_segment = VIP`

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

### Requirement: Clients with orders stay
A client with at least one Loyiha SHALL NOT be deleted; it is deactivated instead.

#### Scenario: Delete client with projects
- WHEN deleting a client with at least one Loyiha
- THEN 409 — deactivate instead
