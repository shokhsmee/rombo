# platform — delta

## ADDED Requirements

### Requirement: Workflow fields move only through actions
A document's `status` and the fields its workflow stamps (`posted_at`, `sent_at`, `sent_via`, `submitted_at`,
`approved_at`, `source_model` / `source_id` / `source_label`) SHALL be read-only in create and update. They
change only through the document's action endpoints (submit, approve, send, post, cancel).

#### Scenario: Draft receipt patched to posted
- WHEN `PATCH /procurement/receipts/{id}/ {"status": "posted"}` is sent for a draft receipt
- THEN the receipt stays draft, with no journal entry and no stock move

#### Scenario: Draft order patched to sent
- WHEN `PATCH /procurement/orders/{id}/ {"status": "sent", "sent_via": "email"}` is sent
- THEN the order stays draft and the kassa money gate still applies to "Yuborish"

### Requirement: Row locks work on PostgreSQL
Every service that locks a row SHALL lock only that row (`select_for_update(of=("self",))`), so the lock also
works when the query joins nullable relations.

#### Scenario: Posting a cash order on PostgreSQL
- WHEN a cashier posts a kassa order that has no project or invoice
- THEN it is posted (before: 500 "FOR UPDATE cannot be applied to the nullable side of an outer join")
