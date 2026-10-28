# Design: bootstrap-foundation

## Decisions

### Django + DRF instead of FastAPI
A first prototype was written in FastAPI (commit `aa0ca1d`) and replaced the same day (`abeda00`)
at the product owner's request. Django gives admin, migrations, auth and a convention every Python
developer knows — important for a long-lived ERP with a changing team. See ADR 0001.

### services.py holds all writes
DRF's default puts logic in serializers' `create/update`. That spreads rules across serializers
and makes them unusable from commands/tasks. We keep serializers for validation and shape only,
and route writes through `ServiceModelViewSet.perform_*` → `services.<thing>_<verb>(*, actor, ...)`.
See ADR 0002.

### Page-level permissions instead of Django model permissions
Django's `add/change/delete/view` per model doesn't match what users manage: they think in
screens ("Mijozlar", "Loyihalar"). A screen may span several models (Loyiha + history, later
items/BOM). So permissions are keyed by page in our own registry. See ADR 0003.

### Codes from the primary key
`MJ-00012` is assigned right after the first insert from the PK, inside the same transaction.
Rejected: `max(id)+1` before insert — races under concurrent saves.

### Soft delete
Clients, employees and projects are referenced by future documents for years. `deleted_at` +
`ActiveManager` hides them; `all_objects` still reaches them for reports.

### Token version
JWTs are stateless; to block a user immediately we embed `tv` and compare with
`User.token_version` on every request (one PK lookup, already done by SimpleJWT).

## Known limitations
- Effective permissions are computed per request (one small query). Cache if it shows up in profiles.
- `department` and `region` are free text for now; promote to tables when HR/analytics need it.
