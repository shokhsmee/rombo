# Design: add-purchase-approvals-and-money-requests

## Approval steps are roles, not people
A step names an `access.Role`; any active member of that role (or a superuser) may decide it. People change,
roles stay. Rejected: a user per step — a holiday blocks every request; amount thresholds per step — request
lines carry no reliable price (prices are set on the order); can be added later on the order.

The endpoint still needs `purchase_approve.update` (page permission, ADR 0003); the service additionally
checks membership of the current step's role (409 "Bu bosqichni <step> tasdiqlaydi"). Single-level
approval (old behaviour, incl. auto-approve when the submitter is an approver) remains when no step is
active, so small installations need no setup.

## Money request lives in kassa (ADR 0009)
Kassa owns the document because kassa approves and pays it, and other modules will ask for money too.
`source_model` / `source_id` keep kassa free of procurement. Statuses: draft → submitted → approved |
rejected; approved → paid (derived: Σ posted RKO linked ≥ amount); draft / submitted / approved → cancelled.
Rejected: approval directly on the RKO draft — kassa would approve and pay in one click with nobody else
seeing the request; the buyer needs a decision before money moves.

## The gate is on sending the order
The order is where price, supplier and currency are known; sending it is the commitment to the supplier.
`order_send` raises 409 "Kassa pul so'rovini tasdiqlamagan" unless the linked request is approved or paid.
Rejected: gating order creation — the amount is not known before the order is priced.
