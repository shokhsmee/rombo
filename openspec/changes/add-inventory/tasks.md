# Tasks: add-inventory

## Backend
- [ ] App `apps/inventory`: `Warehouse`, `Product`, `StockMove` (+ TRACK, codes `MH-`, `OM-`), migration
- [ ] `selectors.py`: stock per product × warehouse, product totals, average cost, summary, Loyiha block
- [ ] `services.py`: warehouse / product CRUD, move create / update / delete / post / cancel, postings by
      role, `product_for`, `stock_role`, `source_moves_post`, `source_moves_cancel`
- [ ] Serializers, views (`page_key`, `permission_action_map`), urls, `config/urls.py`, settings
- [ ] Registry pages `inventory`, `stock`, `products`, `warehouses`; chatter pages; seed role "Omborchi"
- [ ] Procurement: `GoodsReceipt.warehouse` + migration; KR post creates kirim rows, debit role from the
      product; KR cancel cancels them
- [ ] Loyiha detail block `stock`
- [ ] API tests for every scenario of `specs/inventory`, `specs/procurement` (new ones), `specs/projects`

## Frontend
- [ ] `src/modules/inventory/api.ts`, labels
- [ ] "Ombor" moves list (Toolbar filters, Kpi row) and move record page (post / cancel)
- [ ] "Qoldiqlar" stock page, "Mahsulotlar" list + record page, "Omborlar" page
- [ ] Routes, sidebar group "Ombor", `PageKey`s
- [ ] KR card: warehouse picker, "Ombor" smart button; Loyiha card: "Ombor" smart + Chiqim / Ishlab
      chiqarish / Yetkazish actions

## Close
- [ ] Tests green, frontend builds, flow walked in the running app
- [ ] ADR 0010, archive, specs merged, CHANGELOG
