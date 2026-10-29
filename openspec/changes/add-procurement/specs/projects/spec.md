# projects — delta

## MODIFIED Requirements

### Requirement: Status workflow
Allowed moves SHALL be:

| From | To |
|---|---|
| draft | confirmed, cancelled |
| confirmed | procurement, production, draft, cancelled |
| procurement | production, cancelled |
| production | ready |
| ready | delivered |
| delivered | closed |
| cancelled | draft |
| closed | — |

`POST /projects/{id}/status/ {status, comment}`. Detail returns `allowed_statuses`. The row is locked
(`select_for_update`) during the check. The move `confirmed → procurement` is also made by the system when
the first purchase order holding the Loyiha's lines is sent (see `procurement`).

#### Scenario: Invalid jump
- WHEN draft → ready
- THEN 400 on field `status`

#### Scenario: Cancel needs a reason
- WHEN → cancelled without comment
- THEN 400 on field `comment`

#### Scenario: First order sent
- WHEN a `confirmed` Loyiha's lines are on an order that is sent
- THEN the Loyiha is `procurement`

## ADDED Requirements

### Requirement: Procurement on the card
The Loyiha detail SHALL return `procurement: {requests, orders, received_pct}` (counts, and the share of
ordered quantity already received) and the card shows a smart button "Xaridlar" opening the requests and
orders filtered by the Loyiha.

#### Scenario: Smart button counts
- WHEN a Loyiha has one approved request and two orders, one fully received
- THEN `procurement = {requests: 1, orders: 2, received_pct: 50}`
