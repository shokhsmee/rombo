# Change: add-purchase-approvals-and-money-requests  (status: proposed)

## Why
Purchasing needs control before money leaves: every purchase request passes the people responsible in
order (e.g. Ta'minot boshlig'i, then Direktor), and every purchase asks kassa for the money; only after
kassa approves may the buyer place the order with the supplier. Starting a purchase from the Loyiha also
takes too many screens.

## What changes
- **Approval steps** (`procurement.ApprovalStep`): ordered levels, each with a name and an `access.Role`
  whose members approve it; Sozlamalar → "Tasdiqlash bosqichlari" (page `approval_steps`). A submitted
  request waits at the first active step, moves on with each approval and is `approved` after the last;
  any step may reject with a reason. Each decision is a `RequestApproval` row (step, user, decision,
  comment, time) shown on the request. With no active steps the old single-level approval stays.
- **Money request** (`kassa.PaymentRequest`, "Pul so'rovi", `PS-00001`): partner, Loyiha, amount,
  currency, purpose, basis, needed-by date, generic source; statuses draft → submitted → approved |
  rejected → paid; cancelled. Approve / reject by page `payment_approve`; "Pul berish" opens an RKO linked
  to the request; posting linked RKOs that reach the amount marks it `paid`. Page `payment_requests`.
- **Purchase order gate**: "Pul so'rash" on a draft order creates and submits a money request for the order's
  gross (editable amount); the order shows its money state; **sending the order needs an approved (or paid)
  money request** (409 otherwise). Cancelling the order cancels an unpaid request.
- **From the Loyiha**: `POST /procurement/requests/from-project/ {project_id}` drafts a request from all the
  Loyiha's hisob-kitob lines; the card gets "Xaridga yuborish".
- ADR 0009: kassa sits under procurement.

## Impact
Backend: `procurement` (ApprovalStep, RequestApproval, request fields `approval_step`, order FK
`payment_request`, services, views), `kassa` (PaymentRequest, CashOrder FK `payment_request`, services,
views), `access` registry (`approval_steps`, `payment_requests`, `payment_approve`), chatter pages, seed roles.
Frontend: approval steps settings page, request approval panel, order "Pul so'rash" + money state, kassa
"Pul so'rovlari" list + form with approve / reject / "Pul berish", Loyiha "Xaridga yuborish".
