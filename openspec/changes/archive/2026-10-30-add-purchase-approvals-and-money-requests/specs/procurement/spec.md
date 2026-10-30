# procurement — delta

## ADDED Requirements

### Requirement: Approval steps
The system SHALL keep ordered approval steps (`sequence`, `name`, `role`, `is_active`) edited on page
`approval_steps`. When at least one step is active, a submitted request SHALL wait at the first active
step and move to the next with each approval; after the last it is `approved`. A step SHALL be decided only
by an active member of its role or a superuser. Every decision is stored (step, user, approved | rejected,
comment, time) and written to chatter.

#### Scenario: Two levels
- WHEN steps "Ta'minot boshlig'i" and "Direktor" are active and a request is submitted
- THEN it is `submitted` at "Ta'minot boshlig'i"; after that step approves it waits at "Direktor"; after the
  Direktor approves it is `approved` and has two approval rows

#### Scenario: Wrong person
- WHEN a user who is not in the current step's role approves
- THEN 409 and the request does not move

#### Scenario: Reject at level two
- WHEN the Direktor rejects with comment "Qimmat"
- THEN the request is `rejected`, the rejection is stored, and reopening starts again from step one

#### Scenario: No steps configured
- WHEN no step is active
- THEN the single-level approval with `purchase_approve.update` works as before

### Requirement: Purchase from the Loyiha
`POST /procurement/requests/from-project/ {project_id}` SHALL create a draft request for the Loyiha with
the lines of all its hisob-kitob sheets (quantity > 0). Needs `procurement.create`.

#### Scenario: One click from the card
- WHEN a Loyiha has a calculation with 3 lines of quantity > 0
- THEN a draft request with those 3 lines is created and returned

### Requirement: Money request for an order
`POST /procurement/orders/{id}/request-money/ {amount?, note?}` SHALL create and submit a kassa money
request for the order (partner = supplier, Loyiha, currency, default amount = order gross) and link it.
An order SHALL be sent only when its money request is approved or paid. Cancelling the order cancels an
unpaid request.

#### Scenario: Send before kassa approves
- WHEN sending an order whose money request is `submitted`
- THEN 409 "Kassa pul so'rovini tasdiqlamagan"

#### Scenario: Send after approval
- WHEN kassa approves the request
- THEN the order can be sent
