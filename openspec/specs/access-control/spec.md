# access-control

## Purpose
Who can log in, and what each user may see and do on every page.

## Requirements

### Requirement: Login
The system SHALL issue JWT access + refresh tokens for a valid active user and reject everything else with one generic message.

#### Scenario: Wrong password or unknown user
- WHEN credentials are wrong or the user does not exist
- THEN `POST /auth/login/` returns 401 "Login yoki parol noto'g'ri"

### Requirement: Session revocation
Each user has `token_version`, embedded in tokens as claim `tv`. A token with an older version SHALL be rejected, for access and refresh alike.

#### Scenario: User blocked
- WHEN an admin sets `is_active=false`
- THEN every existing token of that user returns 401

#### Scenario: Password changed or reset
- WHEN the password changes
- THEN all previously issued tokens are rejected

### Requirement: Page registry
Every page SHALL be declared once in `apps/access/registry.py` with a permanent key, label, group and supported actions. Modules not yet built MAY be declared `planned`.

### Requirement: Role permission matrix
A role SHALL hold one row per page with `can_view, can_create, can_update, can_delete`. Any write flag SHALL imply view. Actions a page doesn't support SHALL be stored false. Saving a role replaces its whole matrix.

#### Scenario: Write implies view
- WHEN a role is saved with `clients.can_create=true` only
- THEN it is stored with `can_view=true`

#### Scenario: System role
- WHEN deleting a role with `is_system=true`
- THEN 409

### Requirement: Effective permissions
User permissions SHALL be the union of their roles; superusers get everything. `GET /auth/me/` returns `{page_key: [actions]}`. Every viewset SHALL be guarded by `PagePermission`.

#### Scenario: Enforcement
- WHEN a user without `clients.delete` calls `DELETE /clients/{id}/`
- THEN 403, whatever the UI shows

### Requirement: Users are never deleted
Users are referenced by audit columns. Delete SHALL return 409; block (`is_active=false`) instead. A user SHALL NOT block themselves or drop their own superuser flag.

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
