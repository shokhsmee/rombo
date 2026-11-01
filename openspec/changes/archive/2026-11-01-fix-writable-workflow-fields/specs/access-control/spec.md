# access-control — delta

## ADDED Requirements

### Requirement: Only a superuser makes or manages superusers
Granting `is_superuser`, and editing, blocking or resetting the password of a superuser, SHALL be refused with
409 unless the actor is a superuser. Users → create / update stays enough for ordinary accounts.

#### Scenario: HR promotes itself
- WHEN a user with Users → update (not superuser) sends `PATCH /users/{own id}/ {"is_superuser": true}`
- THEN 409 and nothing changes

#### Scenario: HR resets the superuser's password
- WHEN that user posts `/users/{superuser id}/reset-password/`
- THEN 409
