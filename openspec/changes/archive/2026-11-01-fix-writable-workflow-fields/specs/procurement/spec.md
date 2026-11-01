# procurement — delta

## ADDED Requirements

### Requirement: Goods receipt lines are unique per order line
A receipt SHALL have at most one line per order line, and its order SHALL NOT change after creation.

#### Scenario: Same order line twice
- WHEN a receipt is saved with two lines for one order line
- THEN 400 on `lines`

#### Scenario: Order swapped on a draft receipt
- WHEN a draft receipt is patched with another `order_id`
- THEN 409 and the receipt keeps its order and supplier
