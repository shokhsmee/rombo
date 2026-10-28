# ADR 0002 — Business logic lives in services.py

- Status: accepted
- Date: 2026-10-28

## Context
In big Django projects rules end up scattered across `save()`, signals, serializers and views.
Finding "why did this order change status" becomes archaeology.

## Decision
- Writes go through plain functions in `apps/<app>/services.py`: `thing_create(*, actor, **fields)`,
  `thing_update(obj, *, actor, **fields)`, `thing_<verb>(obj, *, actor, ...)`.
- Services own transactions (`@transaction.atomic`) and raise `apps.core.exceptions.*`.
- Serializers validate and shape; views (`ServiceModelViewSet`) only wire the two together.
- No signals for business rules. Cross-app writes call the other app's service.

## Consequences
- One place to read per rule; services are callable from commands, tasks and tests.
- Slightly more code than serializer `.save()`; accepted for clarity.
