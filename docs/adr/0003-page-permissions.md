# ADR 0003 — Page-level CRUD permissions via roles

- Status: accepted
- Date: 2026-10-28

## Context
Admins want to open a role and tick, for every screen, whether it is visible and which of
create/update/delete are allowed.

## Decision
- A code registry (`apps/access/registry.py`) lists pages with permanent keys and supported actions.
- `Role` → `RolePermission(page_key, can_view, can_create, can_update, can_delete)`.
- Users have many roles; effective permission = union. `is_superuser` bypasses.
- `PagePermission` maps DRF actions to registry actions; custom actions declare theirs.
- The frontend gets `permissions` from `/auth/me/` and hides menu items and buttons; the API
  enforces regardless.

## Rejected
- Django model permissions/groups — per model, not per screen; users can't map them to the UI.
- Row-level rules (e.g. "only my clients") — not needed yet; will be a separate ADR if it comes.
