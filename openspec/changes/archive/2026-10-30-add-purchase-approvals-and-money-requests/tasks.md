# Tasks: add-purchase-approvals-and-money-requests

## Backend
- [x] procurement: ApprovalStep, RequestApproval, `PurchaseRequest.approval_step`, `PurchaseOrder.payment_request`
- [x] procurement services: multi-level submit / approve / reject, request_from_project, order_request_money,
      send gate, cancel releases the request
- [x] kassa: PaymentRequest (PS-), `CashOrder.payment_request`, services create / update / submit / approve /
      reject / cancel, paid derived on RKO post / cancel, selector payment_request_state
- [x] registry pages approval_steps, payment_requests, payment_approve; CHATTER_PAGES; seed roles
- [x] serializers, views, urls; migrations
- [x] tests: steps advance and reject, role check, fallback single level, from-project, money request
      lifecycle, gate 409, paid on RKO post, permissions

## Frontend
- [x] Sozlamalar → Tasdiqlash bosqichlari
- [x] request page: approval track and history, approve / reject for the current step
- [x] order page: "Pul so'rash", money state pill, Send disabled until approved
- [x] kassa: Pul so'rovlari list + form, approve / reject, "Pul berish" → RKO prefilled
- [x] Loyiha card: "Xaridga yuborish"

## Docs
- [x] ADR 0009, archive, CHANGELOG
