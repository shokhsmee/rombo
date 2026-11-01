# Change: fix-writable-workflow-fields  (status: archived 2026-11-01)

## Why
The 2026-11-01 audit (`docs/audit/2026-11-01-full-test.md` #1, #2, #8) found:
- `status`, `posted_at`, `sent_at`, `source_*` were writable through PATCH/POST. A plain
  `PATCH {"status": "posted"}` turned draft KR-00005 into "posted" with no entry, no stock and no `posted_at`.
  The same skipped purchase approval, the kassa money gate, and the stock check on moves.
- `is_superuser` was writable by anyone with Users → edit. That person could also reset or block the real
  superuser.
- Two receipt lines on the same order line each passed the "remaining" check, so stock was received twice.

The first full test run on PostgreSQL then found a fourth bug. Every `select_for_update()` next to a
`select_related` on a nullable FK fails with "FOR UPDATE cannot be applied to the nullable side of an outer
join". SQLite ignores the lock, so tests never saw it. On production (PostgreSQL) it breaks posting kassa
orders, receipts and stock moves, money requests, invoice confirmation and lead conversion.

## What changes
- Workflow fields are `read_only_fields` in the serializers of requests, orders, receipts, stock moves, cash
  orders, payment requests, journal entries, invoices, leads, calls and Telegram accounts. They change only
  through the action endpoints.
- A receipt's order cannot be swapped after creation (409).
- A receipt with two lines for one order line is refused (400 on `lines`).
- `users.services`: only a superuser grants `is_superuser` or edits, blocks or resets a superuser (409 for
  others).
- Every `select_for_update()` locks only its own row: `select_for_update(of=("self",))`.

## Impact
Serializers of procurement, inventory, kassa, accounting, crm and telegram; `users/services.py`;
`procurement/services.py`; 18 service files (row locks). No migration and no frontend change: the UI never
sent these fields.
