# ADR 0009 — Kassa sits under procurement: purchases ask kassa for money

- Status: accepted
- Date: 2026-10-30
- Supersedes: ADR 0007, decision 5, the sentence "`procurement` and `kassa` never import each other"

## Context
Every purchase now needs a money request (pul so'rovi) that kassa approves before the order may go to the
supplier, and kassa pays it with an RKO. Procurement must create the request and read its status.

## Decision
Dependency direction becomes
`core ← access ← users ← employees ← clients ← projects ← accounting ← kassa ← procurement / mrp / production`.
- `kassa` owns `PaymentRequest` and knows its source only generically (`source_model` + `source_id`,
  like accounting and chatter); it never imports procurement.
- `procurement` calls `kassa.services.payment_request_create / payment_request_submit` and reads
  `kassa.selectors.payment_request_state`; the order keeps an FK to its request.

## Rejected
- *Money request inside procurement* — kassa would have to import procurement to approve and pay it,
  and requests for other spending (MRP, production, office) would each need their own document.
- *No link, kassa reads purchase orders* — the leaf would sit under the cash desk; every new spending
  module would touch kassa.

## Consequences
Any module that spends money (MRP, production) asks kassa the same way. Kassa stays free of their models.
