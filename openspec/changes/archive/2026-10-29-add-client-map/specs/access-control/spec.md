# access-control — delta

## ADDED Requirements

### Requirement: CRM pages
The registry SHALL have page `client_map` "Mijozlar xaritasi" in group "CRM", view only. Roles that
could view clients when it was introduced get its view permission.

#### Scenario: Existing sales role after upgrade
- WHEN the migration runs on a database where role "Savdo menejeri" can view clients
- THEN that role can view `client_map`

### Requirement: Endpoints needing two pages
An endpoint MAY require a second page on top of its viewset's page (`page_required(page, action)`);
both checks SHALL pass.

#### Scenario: Second page missing
- WHEN a user has only one of the two required pages
- THEN 403
