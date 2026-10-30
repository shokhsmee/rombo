# kassa — delta

## ADDED Requirements

### Requirement: Money request
A money request (pul so'rovi) SHALL have code `PS-NNNNN`, partner, optional Loyiha, amount > 0, currency,
purpose, basis, needed-by date, requester and an optional generic source (`source_model`, `source_id`).
Statuses: draft → submitted → approved | rejected; approved → paid (derived); draft, submitted, approved →
cancelled. Approve and reject need page `payment_approve`; reject needs a comment. Changes go to chatter.

#### Scenario: Kassa rejects
- WHEN a submitted request is rejected without a comment
- THEN 400 on field `comment`

### Requirement: Paying a money request
"Pul berish" SHALL open a chiqim prefilled from an approved request (account in its currency, amount still
open, partner, Loyiha, purpose). Posting chiqims linked to the request that reach its amount SHALL mark it
`paid`; cancelling such a chiqim returns it to `approved`. A chiqim cannot be linked to a request that is
not approved or paid.

#### Scenario: Paid in one go
- WHEN an approved request of 10 000 000 is paid with a linked RKO of 10 000 000 that is posted
- THEN the request is `paid`
