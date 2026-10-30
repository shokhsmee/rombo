# Design: add-inventory

## One table of moves, stock derived
`StockMove` is the inventory ledger: one row = one product moved once. Stock on hand and its value are
sums over posted rows grouped by product and warehouse:

| type | warehouse | to_warehouse | posts |
|---|---|---|---|
| `receipt` Kirim | + qty, + amount | — | nothing of its own: the KR's entry already debits stock |
| `issue` Chiqim | − | — | Dt `wip` (Loyiha) · Kt stock role |
| `output` Ishlab chiqarish | + | — | Dt `finished_goods` · Kt `wip` (Loyiha) |
| `delivery` Yetkazish | − | — | Dt `cogs_products` (Loyiha, client) · Kt stock role |
| `transfer` Ko'chirish | − | + | nothing (same account) |
| `adjust` Tuzatish, qty > 0 | + | — | Dt stock role · Kt `other_op_income` |
| `adjust` Tuzatish, qty < 0 | − | — | Dt `other_op_expense` · Kt stock role |

`qty` and `amount` are positive except for `adjust`, where they carry the sign. The **stock role** of a
product is `finished_goods` (2810) for category `tayyor`, else `materials` (1010). The KR posting asks
inventory for that role per line, so **stock value = ledger balance of 1010 + 2810** for every product that
moved through inventory — the same invariant as kassa balance = ledger balance.

*Rejected:* a header + lines document per movement (like KR). The user asked for every movement as a row
of one table; a one-product row is also what the stock query needs. Several products at once are several
rows sharing a source document.
*Rejected:* storing `qty_on_hand` on `Product` — the ADR 0007 argument: one missed path and it drifts.

## Costing: weighted average per product
Outgoing rows (`issue`, `delivery`, negative `adjust`) are valued at product value / product qty across all
warehouses at posting time, computed under a row lock on the product. When the row takes all that is left,
the amount is the whole remaining value. `transfer` carries the average for display only; it changes no
product totals. `output` is valued at what the Loyiha has in work in progress (ledger `wip` balance of the
Loyiha) unless a unit cost is typed; it may not exceed that balance. Positive `adjust` uses the typed cost,
else the current average, else the product's default cost.
*Rejected:* FIFO — needs layer tables and gives Rombo (made-to-order, few products) nothing it needs today.

## Dependency direction
`… ← projects ← accounting ← inventory ← procurement`. Inventory imports accounting services / selectors,
projects, clients, pricing, employees. It never imports procurement: a KR is referenced as
`source_model = "procurement.goodsreceipt"` + `source_id` + `source_label`. Procurement calls
`inventory.services.product_for`, `stock_role`, `source_moves_post` and `source_moves_cancel`.
The Loyiha card gets its block through `projects.extensions.register_detail_block("stock", …)`.

## Statuses
`draft → posted → cancelled`. Drafts are editable and deletable. Posting checks stock, the lock date, the
required fields of the type (Loyiha for issue / output / delivery, target warehouse for transfer,
`tayyor` category for output), writes the entry and freezes the row. Cancelling needs a reason, reverses
the entry and is refused when the stock it would take back is no longer there. Rows that came from a KR
are cancelled only by cancelling the KR.
