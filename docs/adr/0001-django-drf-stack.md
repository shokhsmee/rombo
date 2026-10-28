# ADR 0001 — Django + DRF backend, React + Mantine frontend

- Status: accepted
- Date: 2026-10-28

## Context
Rombo ERP will grow to many modules (sales, procurement, MRP, production, warehouse, finance)
and be maintained for years by a changing team.

## Decision
- Backend: Django 5 + Django REST Framework, SimpleJWT, django-filter, drf-spectacular.
  SQLite in dev, PostgreSQL in production.
- Frontend: React + TypeScript + Vite with Mantine 7 (dense data UI, forms, dates) and
  TanStack Query for server state.

## Why
- Django: migrations, admin (free back-office for support), auth, a single well-known convention.
- DRF: filters, pagination, schema generation and permissions out of the box.
- Mantine over shadcn/Tailwind: ready accessible inputs (dates, selects, number) needed in
  every ERP form; theming through one object rather than hundreds of class strings.

## Rejected
- FastAPI + SQLAlchemy — prototyped first; leaner, but we'd rebuild admin, auth and conventions ourselves.
- Ant Design — heavy and visually recognisable; harder to make it look like Rombo's own tool.
