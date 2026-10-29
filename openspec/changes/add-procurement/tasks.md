# Tasks: add-procurement

## Backend
- [ ] clients: `ClientKind.SUPPLIER`, supplier fields + migration (`clients -n supplier_kind`);
      suppliers hidden from the default client list, `?kind=supplier` for the suppliers page; TRACK labels
- [ ] apps/procurement: models (request, order, receipt + lines, `TRANSITIONS`, codes XS/XB/KR, TRACK)
- [ ] services: request_create/update/submit/approve/reject/cancel, request_from_calc;
      order_create_from_requests, order_update, order_send, order_cancel; receipt_create_from_order,
      receipt_update, receipt_post (ledger entry + advance offset), receipt_cancel
- [ ] selectors: last price per (supplier, item); lines per Loyiha; supplier balance via accounting
- [ ] serializers + views (`ServiceModelViewSet`, `permission_action_map`), urls `/procurement/…`
- [ ] registry pages: procurement (planned=False), purchase_approve, purchase_orders, goods_receipts, suppliers
- [ ] chatter: `CHATTER_PAGES` for the three models
- [ ] email: order HTML template, `EMAIL_*` settings from env, 409 when unconfigured
- [ ] projects: status to `procurement` on first send (service call + test); `procurement` block on detail
- [ ] migrations: `makemigrations procurement -n initial`
- [ ] tests: workflow per document, approval auto-pass, send (print / email / unconfigured), receipt posting
      balances and offsets the advance, partial receipts derive order status, lines locked after sent (409),
      lock date (409)

## Frontend
- [ ] `src/modules/procurement/`: api.ts, RequestsListPage, RequestFormPage (from hisob-kitob),
      OrdersListPage, OrderFormPage (send dialog: via / to), ReceiptsListPage, ReceiptFormPage (post),
      print/OrderPrint
- [ ] Suppliers page (filtered clients + supplier fields); client form kind switch
- [ ] Loyiha card: smart button "Xaridlar"
- [ ] nav group Ta'minot; `useCan` on every button

## Docs
- [ ] project.md roadmap, archive, merge spec deltas, CHANGELOG
