# ADR 0010 — Stock is a sum of moves in one table; inventory sits between accounting and procurement

- Status: accepted
- Date: 2026-10-30
- Relates to: ADR 0007 (ledger is the source of truth), ADR 0004 (Loyiha as hub)

## Context
Materials received with a goods receipt (KR) had no further life: no stock on hand, no issue to a Loyiha,
no cost of goods sold. The user wants every movement of stock — kirim, chiqim, yetkazish — as one row in
one table, with products and amounts.

## Decision
1. **One table of moves.** `inventory.StockMove` holds one row per product per movement (receipt, issue,
   output, delivery, transfer, adjust). Stock on hand and its value are sums over posted rows; nothing
   stores a balance (the ADR 0007 rule applied to quantities).
2. **Money still lives in the ledger.** Every move that changes an account posts through
   `accounting.services.entry_post` by role; a receipt row reuses the KR's entry. The KR's debit role per
   line comes from inventory (`materials` or `finished_goods`), so stock value equals the stock accounts.
3. **Dependency direction**: `… ← projects ← accounting ← inventory ← procurement` (production and mrp will
   hang below inventory too). Inventory references source documents generically (`source_model`,
   `source_id`, `source_label`) and never imports procurement.
4. **Weighted average cost per product**, computed at posting time under a product row lock.

## Rejected
- *Document with lines per movement* — the user asked for rows; the stock query wants rows anyway.
- *Quantity on the product, updated by services* — drifts on the first forgotten path.
- *Inventory under procurement* — production and the Loyiha also move stock; procurement is one source.

## Consequences
- KRs posted before inventory existed have no rows; the first stock count brings them in with `adjust`.
- A future MRP can read stock and on-order quantities from the same table.
