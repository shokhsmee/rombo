# Change: add-inventory  (status: proposed)

Depends on: `add-accounting` (moves post through the ledger), `add-procurement` (goods receipt `KR`).
Closes the gap the procurement plan left open: stock and cost of goods sold (`Dt 9110 Kt 2810`).

## Why
Materials arrive with a goods receipt and disappear from view: nobody can say what lies in the warehouse,
what went into which Loyiha, or what the delivered order cost. The user asked for one place where
**kirim, chiqim, yetkazish, products and amounts live as rows of one table** — every movement of stock one
row, and stock on hand derived from those rows, the way balances are derived from the ledger (ADR 0007).

## What changes
New app `apps/inventory`, page group **Ombor**:

- **Omborlar** (`Warehouse`): name, address, responsible employee, default flag, active flag. "Asosiy ombor"
  is created on first use and is the default.
- **Mahsulotlar** (`Product`, code `MH-00001`): name, SKU, unit, category `profil | oyna | furnitura |
  material | tayyor` (finished product), default cost, optional link to a price-list item. Products are
  created by hand or automatically by the first goods receipt that brings an unknown item.
- **Ombor harakatlari** (`StockMove`, code `OM-00001`) — **one row per product per movement**, one table:
  type `receipt` (Kirim, from a KR) · `issue` (Chiqim to production for a Loyiha) · `output` (Ishlab
  chiqarish: a finished product enters the warehouse) · `delivery` (Yetkazish to the client of a Loyiha) ·
  `transfer` (Ko'chirish between warehouses) · `adjust` (Tuzatish: count surplus / shortage, opening
  stock). Each row: date, product, warehouse (+ target warehouse), qty, unit cost, amount, Loyiha,
  partner, source document, journal entry, status `draft → posted → cancelled`.
- **Stock on hand** (`GET /inventory/stock/`) per product × warehouse, quantity and value = sums over
  posted moves. Nothing stores a balance.
- **Costing**: weighted average per product. Outgoing rows take the current average; issuing the whole
  remaining quantity takes the whole remaining value, so no kopecks are left behind.
- **No negative stock**: posting an outgoing row (or cancelling an incoming one) beyond what the warehouse
  holds is refused (409).
- **Postings** through `accounting.services.entry_post`, by role (see design):
  issue `Dt wip Kt materials`, output `Dt finished_goods Kt wip`, delivery `Dt cogs_products Kt
  finished_goods`, adjust `Dt stock Kt other_op_income` / `Dt other_op_expense Kt stock`; transfer posts
  nothing. Cancel = reversing entry. Lock date respected.
- **Procurement**: posting a KR creates its posted kirim rows (one per line, value = the line's net UZS,
  the same amount the KR debits to stock) into the receipt's warehouse (new field `GoodsReceipt.warehouse`,
  default warehouse when empty); the KR's debit role comes from the product's stock role, so the stock
  account and the stock value always agree. Cancelling a KR cancels its rows (409 if already consumed).
- **Loyiha card**: smart button "Ombor" (moves of the Loyiha, issued / delivered amounts, work in progress)
  and actions "Chiqim", "Ishlab chiqarish", "Yetkazish" opening a pre-filled move.
- **Frontend** `src/modules/inventory/`: "Ombor" list (all moves, filters by type / status / warehouse /
  product / Loyiha / date, KPI row with kirim / chiqim / yetkazish amounts and stock value), move record
  page, "Qoldiqlar" (stock on hand), "Mahsulotlar" list + record page, "Omborlar" settings page. KR card
  gets a warehouse picker and an "Ombor" smart button.

## Impact
- Apps: new `inventory`; `procurement` (receipt warehouse, posting calls inventory); `projects` card via
  `extensions.register_detail_block`; `access` registry; `chatter` pages; `core` seed roles.
- Tables: `inventory_warehouse`, `inventory_product`, `inventory_stockmove`; `procurement_goodsreceipt.warehouse_id`.
- Endpoints: `/inventory/warehouses/`, `/inventory/products/`, `/inventory/moves/` (+ `post`, `cancel`,
  `summary`), `/inventory/stock/`.
- Pages: `inventory` (moves), `stock` (view), `products`, `warehouses`; role "Omborchi".
- Dependency direction (ADR 0010): `… ← projects ← accounting ← inventory ← procurement`.

## Out of scope
- Bills of materials and automatic issue from the Loyiha's hisob-kitob (add-mrp).
- Serial / lot numbers, bins, reservations, returns to supplier, FIFO costing.
- Back-filling stock rows for KRs posted before this change (their value stays on 1010 without rows;
  an `adjust` row per product brings them in when the first count is done).
