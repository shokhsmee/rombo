# Change: add-list-tools  (status: proposed)

## Why
Lists are read one row at a time. Staff keep Excel copies of clients, products and stock counts, retype
them into the ERP, and post or delete documents one by one.

## What changes
One toolkit for every list page, built once in `core` and switched on per viewset (ADR 0011):
- **Excel export** of the current filter, or of the selected rows: `GET <list>/export/` (xlsx, Uzbek
  headers, money and dates as Excel numbers and dates).
- **Excel import** where a row is a self-contained record: `GET <list>/import-template/` and
  `POST <list>/import/` (multipart `file`, `dry_run`). Each row goes through the list's own serializer
  and `service_create`, in its own savepoint; the answer lists every row with its errors. A dry run checks
  everything and saves nothing. References are given by code or name (client "MJ-00012" or its name).
  Import is on for Loyihalar, Mijozlar, Yetkazib beruvchilar, Xodimlar, Mahsulotlar, Ombor harakatlari
  (drafts) and Kirim / chiqim orderlari (drafts). Documents with lines and approval flows (requests,
  orders, receipts, invoices, journal) are exported, not imported.
- **Row selection and batch operations**: a checkbox column, "select page", and a bar with the actions
  the list allows: `POST <list>/bulk/ {ids, action, params}`. Each action calls the same service as the
  single-record button, per row in a savepoint, with the same permission; failures are reported per row
  and the rest succeed. Examples: post / delete drafts (moves, cash orders, receipts, invoices), submit /
  cancel requests, approve / reject payment requests, change Loyiha status, archive clients / products,
  (de)activate users.
- `GET <list>/tabular/` tells the page which batch actions and import columns exist.

## Impact
- `apps/core/tabular.py` (mixin, xlsx helpers); viewsets declare `excel_columns`, `excel_import`,
  `bulk_actions`. New dependency `openpyxl`.
- Frontend: `DataTable` selection, `components/ListTools.tsx` (Excel menu, import dialog, batch bar),
  wired into every list page.
