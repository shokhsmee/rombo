# clients

## Purpose
Buyers who place Loyihalar: individuals, companies, dealers.

## Requirements

### Requirement: Client record
Auto code `MJ-NNNNN`; kind `individual | company | dealer`; name (≥ 2 chars); TIN (9–14 digits, unique among active clients); contact person; two phones; email; region; address; source; notes; active flag; manager (employee).

#### Scenario: Duplicate TIN
- WHEN saving a client with an existing TIN
- THEN 409 on field `tin`

### Requirement: List and search
`GET /clients/` searches code, name, TIN, contact, phones, region; filters `kind`, `region`, `is_active`, `manager`. Detail includes `projects_count`.

### Requirement: Segment
A client MAY have a segment from the `client_segment` list; it is shown on the client's orders.
The `dealer` kind is labelled "Diler / hamkor" and is the pool for a project's partner.

### Requirement: Clients with orders stay
#### Scenario: Delete client with projects
- WHEN deleting a client with at least one Loyiha
- THEN 409 — deactivate instead
