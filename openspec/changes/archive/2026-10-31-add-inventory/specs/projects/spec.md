# projects — delta

## ADDED Requirements

### Requirement: Stock on the card
The Loyiha detail SHALL include a `stock` block from inventory: number of posted moves, amounts issued
(chiqim), output and delivered (yetkazish), and the work-in-progress balance (ledger `wip` of the
Loyiha). The card shows a smart button "Ombor" (moves filtered by the Loyiha) and actions "Chiqim",
"Ishlab chiqarish", "Yetkazish" that open a new move with the Loyiha filled in.

#### Scenario: Card shows what went into the order
- WHEN 2 issues worth 1 500 000 in total are posted for a Loyiha
- THEN its `stock.issued` is "1500000.00", `stock.wip` is "1500000.00" and `stock.moves` is 2
