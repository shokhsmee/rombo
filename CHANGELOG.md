# Changelog

Newest first. Each entry: date · change-id (if any) · what · why (one line).

## 2026-10-29
- `add-chatter-and-uzbridge-design` — Chatter: every tracked record has a history (create, field changes,
  notes) with author and time; Loyiha status history moved into it (old rows migrated).
  Why: one place to answer "who changed what and why", same as uzbridge/Odoo.
- `add-chatter-and-uzbridge-design` — Frontend rebuilt on Tailwind v4 + lucide with uzbridge's tokens and
  kit; record pages get record pager, action bar with status track, smart buttons and a chatter column;
  light/dark theme. Why: first UI was too plain; uzbridge is the house style (ADR 0006).

## 2026-10-28
- `bootstrap-foundation` — Django + DRF backend: auth (JWT + revocation), roles × page CRUD
  permissions, users, employees, clients, Loyihalar with status workflow and history.
  Why: foundation for procurement and MRP; every document must hang off a Loyiha.
- `bootstrap-foundation` — React + Mantine frontend: login, permission-filtered navigation,
  list/form views with search and filters, role matrix, user access preview.
- Backend rebuilt from FastAPI prototype to Django + DRF. Why: product owner's choice; admin,
  migrations and conventions for a long-lived ERP (ADR 0001).
- Client name now requires ≥ 2 characters (found by tests).
