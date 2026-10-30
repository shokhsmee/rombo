# Tasks: add-inventory

## Backend
- [x] App `apps/inventory`: `Warehouse`, `Product`, `StockMove` (+ TRACK, codes `MH-`, `OM-`), migration
- [x] `selectors.py`: stock per product × warehouse, product totals, average cost, summary, Loyiha block
- [x] `services.py`: warehouse / product CRUD, move create / update / delete / post / cancel, postings by
      role, `product_for`, `stock_role`, `source_moves_post`, `source_moves_cancel`
- [x] Serializers, views (`page_key`, `permission_action_map`), urls, `config/urls.py`, settings
- [x] Registry pages `inventory`, `stock`, `products`, `warehouses`; chatter pages; seed role "Omborchi"
- [x] Procurement: `GoodsReceipt.warehouse` + migration; KR post creates kirim rows, debit role from the
      product; KR cancel cancels them
- [x] Loyiha detail block `stock`
- [x] API tests for every scenario of `specs/inventory`, `specs/procurement` (new ones), `specs/projects`

## Frontend
- [x] `src/modules/inventory/api.ts`, labels
- [x] "Ombor" moves list (Toolbar filters, Kpi row) and move record page (post / cancel)
- [x] "Qoldiqlar" stock page, "Mahsulotlar" list + record page, "Omborlar" page
- [x] Routes, sidebar group "Ombor", `PageKey`s
- [x] KR card: warehouse picker, "Ombor" smart button; Loyiha card: "Ombor" smart + Chiqim / Ishlab
      chiqarish / Yetkazish actions

## Close
- [x] Tests green, frontend builds, flow walked in the running app
- [x] ADR 0010, archive, specs merged, CHANGELOG
