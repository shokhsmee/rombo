# Change: bootstrap-foundation

## Why
Every operation in Rombo must be traceable to a customer order (Loyiha). Procurement and MRP
need identity, permissions, master data (clients, employees) and the Loyiha hub first.

## What changes
- Django + DRF backend skeleton: `apps/core` base models, error contract, pagination, `ServiceModelViewSet`.
- **access-control** — JWT login/refresh, users, roles, page × CRUD matrix, token revocation.
- **employees** — HR card with optional login link.
- **clients** — individual / company / dealer, responsible manager.
- **projects** — Loyiha header, status workflow, status history, header lock.
- React frontend: login, permission-filtered sidebar, list + form page per module,
  role matrix editor, user access preview.
- `procurement` and `mrp` registered as planned pages so roles can be prepared now.

## Impact
- Tables: users_user, access_role, access_rolepermission, employees_employee, clients_client,
  projects_project, projects_projectstatuslog
- Endpoints: /auth, /access, /users, /employees, /clients, /projects
- Specs created: access-control, employees, clients, projects
- ADRs 0001–0004
