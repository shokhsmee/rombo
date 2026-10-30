<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../frontend/public/brand/rombo-logo-white.svg">
  <img src="../frontend/public/brand/rombo-logo.svg" alt="Rombo — фабрика сборки окон и дверей" height="48">
</picture>

# Project context — Rombo ERP

## Purpose
ERP for **Rombo**, an Akfa-profile window/door/facade manufacturer. The system follows a customer
order (**Loyiha**) from contract through procurement, material planning (MRP), production and
delivery. Every operational document links back to a Loyiha.

## Roadmap — follows the company process map (`docs/process-map.md`)
1. ✅ Sotuv — Loyihalar, Mijozlar, order card, hisob-kitob (price lists), shartnoma, chertezh
2. ⏳ CRM — leads, telephony, client map (in progress on separate branches)
3. ✅ Buxgalteriya — ledger on NSBU 21, invoices, reconciliation act (ADR 0007);
   ✅ Kassa — kassa/bank accounts, PKO/RKO, advance and remainder per Loyiha
4. ✅ Zakup — request → approval → order → **sent** → kirim, suppliers as clients (ADR 0008)
5. Sklad — receipts, material issue slips
6. Ishlab chiqarish — MRP / production jobs, assembler drawings (`openspec/changes/add-mrp`)
7. O'rnatish — installation, acceptance act, installer drawings
8. Marketing — leads plan, client video/photo reviews

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
