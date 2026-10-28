# Change: add-chatter-and-uzbridge-design

## Why
- The first UI (Mantine) was judged too plain. The product owner wants the look and record-page
  patterns of uzbridge, an existing in-house product people already work with every day.
- Every record needs one place that answers "who changed what, when, and why" and where people can
  leave notes — Odoo's chatter. Today only Loyiha status changes are logged (`ProjectStatusLog`).

## What changes
- **chatter** (new app `apps/chatter`, ported from uzbridge `backend/chatter`):
  - `Message(model, res_id, kind=note|event|track, body, changes[], author, user, created_at)`.
  - Models opt in with `TRACK = {"field": "Label"}`; create and tracked-field changes are written
    automatically (signals + a middleware that remembers the request's user).
  - `GET/POST /api/v1/chatter/?model=&res_id=` — read history, write a note. Allowed only if the
    user can **view** the record's page.
- **projects**: `ProjectStatusLog` is removed; status changes (with the comment) go to chatter.
  `history` disappears from the project payload. Data migration copies old log rows into chatter.
- **clients, employees, users, roles** get `TRACK`; role permission changes and user role changes are
  written as chatter events by their services.
- **Frontend**: Mantine replaced by Tailwind v4 + lucide-react and a small UI kit copied from
  uzbridge (`Button`, `Field`, `Input`, `Select`, `Toggle`, `Pill`, `Kpi`, `Pager`, `Dialog`, toast).
  Same token names as uzbridge (`ground/surface/sunk/ink/muted/faint/line/accent/ok/warn/bad/info/done`),
  Onest + JetBrains Mono, light/dark/system theme. Accent is Rombo blue instead of uzbridge green —
  one token block in `index.css`.
- Record pages follow uzbridge: breadcrumb + record pager (3 / 12 ‹ ›), action bar with a segmented
  status track, smart buttons, form sheet, and a foldable `ChatterPanel` on the right.

## Impact
- New table `chatter_message`; dropped table `projects_projectstatuslog` (data copied first).
- New endpoint `/api/v1/chatter/`.
- Whole `frontend/src` restyled; API/data hooks (`lib/api`, `lib/crud`, `useListParams`, auth) unchanged.
- ADR 0005 (tracking via signals is allowed for audit, not for business rules).
- Specs: new `chatter`; modified `projects` (History requirement).
