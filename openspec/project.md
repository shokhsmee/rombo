# Project context — Rombo ERP

## Purpose
ERP for **Rombo**, an Akfa-profile window/door/facade manufacturer. The system follows a customer
order (**Loyiha**) from contract through procurement, material planning (MRP), production and
delivery. Every operational document links back to a Loyiha.

## Roadmap
1. ✅ Foundation — auth, users, roles × page permissions, employees, clients, Loyihalar
2. ⏳ Procurement — `openspec/changes/add-procurement`
3. ⏳ MRP — `openspec/changes/add-mrp`
4. Later — production jobs, warehouse, delivery/installation, payments, reports

## Tech stack
| Layer | Choice |
|---|---|
| API | Python 3.12, Django 5, Django REST Framework, SimpleJWT, django-filter, drf-spectacular |
| DB | SQLite (dev), PostgreSQL (prod) via `DATABASE_URL` |
| Frontend | React 18 + TypeScript + Vite, Tailwind v4 (uzbridge tokens), lucide-react, TanStack Query, React Router |
| Tooling | uv, npm, pytest-django, ruff |

## API conventions
- Base: `/api/v1/<app>/` (trailing slash). Docs: `/api/v1/docs/`.
- Lists: `?q=&page=&size=&sort=-created_at` + app filters → `{items, total, page, size}`.
  `q` is split by spaces; every word must match one of the search fields.
- Errors: `{"error": {"code", "message", "field", "fields"}}`. 400 validation, 401 auth,
  403 permission, 404 missing, 409 business conflict.
- Permissions: page key × `view|create|update|delete`, registry in `apps/access/registry.py`.

## Glossary
| Uzbek | English | Meaning |
|---|---|---|
| Loyiha | Project / Order | One customer order (one contract, one object) |
| Mijoz | Client | Buyer: individual, company or dealer |
| Xodim | Employee | Staff member (HR card) |
| Foydalanuvchi | User | Login account |
| Rol | Role | Named set of page permissions |
| Xarid | Procurement | Buying profile, glass, accessories from suppliers |
| Ta'minotchi | Buyer | Employee doing procurement |
| STIR | TIN | Tax identification number |
