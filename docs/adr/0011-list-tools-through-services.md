# ADR 0011 — Excel import, export and batch operations go through the same serializers and services

- Status: accepted
- Date: 2026-10-31
- Relates to: ADR 0002 (service layer), ADR 0003 (page permissions)

## Context
Every list page needs Excel export, most need batch actions, and master data needs Excel import. Writing
these per page would give eighteen slightly different importers that skip validation the forms enforce.

## Decision
1. One mixin in `apps/core/tabular.py`, enabled per viewset by declaring `excel_columns`, `excel_import`
   and `bulk_actions`.
2. An imported row is validated by the viewset's own serializer and created by its `service_create`; a
   batch action calls the same service function as the single-record button. No second write path.
3. Permissions are the page's: export needs view, import needs create, each batch action declares the
   action (and, if different, the page) it needs — checked per request.
4. Every row or id runs in its own savepoint: one bad row never blocks the others; the answer reports
   each one.

## Rejected
- *Bulk SQL updates* (`queryset.update`) — they skip chatter, status rules and postings.
- *Client-side Excel* — the browser would need every row and could not validate references.
