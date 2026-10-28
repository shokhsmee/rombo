# projects (Loyihalar)

## Purpose
A Loyiha is one customer order and the hub of the ERP. Procurement, MRP, production, delivery and payments will reference it.

## Requirements

### Requirement: Header
Auto code `LY-YY-NNNNN`; name; client (required); manager; object address; region; contract number/date; deadline; amount `Decimal(18,2) ≥ 0`; currency `UZS | USD`; notes.

### Requirement: Status workflow
| From | To |
|---|---|
| draft | confirmed, cancelled |
| confirmed | procurement, production, draft, cancelled |
| procurement | production, cancelled |
| production | ready |
| ready | delivered |
| delivered | closed |
| cancelled | draft |
| closed | — |

`POST /projects/{id}/status/ {status, comment}`. Detail returns `allowed_statuses`. The row is locked (`select_for_update`) during the check.

#### Scenario: Invalid jump
- WHEN draft → ready
- THEN 400 on field `status`

#### Scenario: Cancel needs a reason
- WHEN → cancelled without comment
- THEN 400 on field `comment`

### Requirement: History
Every status change, including creation, appends to `ProjectStatusLog` (from, to, comment, user, time). Never edited.

### Requirement: Header lock
Header is editable only in `draft` / `confirmed`; otherwise 409, because procurement and MRP plans derive from it.

### Requirement: Delete only drafts
Only drafts are (soft) deleted; others must be cancelled.

### Requirement: Search and filters
Search code, name, contract number, object address, client name, client phone. Filters: `status` (multi), `client`, `manager`, `currency`, `overdue`, `deadline_from/to`. `GET /projects/summary/` returns counts per status.
