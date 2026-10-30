# inventory Specification

## Purpose
Ombor: warehouses, products and one table of stock moves (kirim, chiqim, ishlab chiqarish, yetkazish,
ko'chirish, tuzatish); stock on hand and its value are sums over posted moves (ADR 0010).

## Requirements

### Requirement: Warehouse
A warehouse SHALL have name, address, responsible employee, `is_default`, `is_active`. Exactly one
warehouse is the default; "Asosiy ombor" is created as the default the first time one is needed. A
warehouse with moves cannot be deleted, only deactivated.

#### Scenario: Default warehouse on first use
- WHEN a goods receipt is posted and no warehouse exists
- THEN "Asosiy ombor" is created as default and the kirim rows go there

### Requirement: Product
A product SHALL have code `MH-NNNNN`, name, SKU, unit, category `profil | oyna | furnitura | material |
tayyor`, `default_cost`, optional price-list item, active flag. The list returns quantity and value on hand.
A product with moves is archived, not deleted.

#### Scenario: Product created by a receipt
- WHEN a KR line names an item with no matching product (by price-list item, else by name and unit)
- THEN a product with that name and unit is created and the kirim row uses it

### Requirement: Stock move
A stock move SHALL be one row per product per movement with code `OM-NNNNN`, type `receipt | issue |
output | delivery | transfer | adjust`, status `draft → posted → cancelled`, date, product, warehouse,
`to_warehouse` (transfer), qty, unit cost, amount, Loyiha, partner, source document
(`source_model`, `source_id`, `source_label`), journal entry, notes. Issue, output and delivery require a
Loyiha; output requires a `tayyor` product; transfer requires a different target warehouse; qty is > 0
except for adjust (non-zero, signed). Receipt rows are created only by posting a KR. Drafts are editable
and deletable; posted rows are immutable. Changes go to chatter.

#### Scenario: Issue without a Loyiha
- WHEN posting an issue with no Loyiha
- THEN 400 on field `project`

#### Scenario: Receipt typed by hand
- WHEN creating a move of type `receipt` through the API
- THEN 400 on field `type`

### Requirement: Stock on hand
`GET /inventory/stock/` SHALL return per product × warehouse the quantity and value as sums over posted
moves (receipt, output, positive adjust and incoming transfer add; issue, delivery, negative adjust and
outgoing transfer subtract), with the average cost and totals. Filters: warehouse, category, search,
`nonzero`.

#### Scenario: Derived quantity
- WHEN 100 m of profile is received and 30 m issued
- THEN the stock shows 70 m and value = receipt amount − issue amount

### Requirement: Average cost
Outgoing rows SHALL be valued at the product's weighted average cost (value / qty over all warehouses)
at posting time; a row that takes the whole remaining quantity takes the whole remaining value.

#### Scenario: Issue at average
- WHEN 100 m was received at 10 000 and 100 m at 12 000, and 50 m is issued
- THEN the issue's unit cost is 11 000 and amount 550 000

### Requirement: No negative stock
Posting an outgoing row SHALL be refused with 409 when the warehouse holds less than its qty; cancelling
an incoming row (or a transfer) likewise when the stock it would take back is gone.

#### Scenario: Over-issue
- WHEN 70 m is on hand and an issue of 80 m is posted
- THEN 409 "Omborda yetarli emas"

### Requirement: Postings
Posting SHALL write one journal entry through accounting by role: issue `Dt wip Kt <stock role>`, output
`Dt finished_goods Kt wip`, delivery `Dt cogs_products Kt <stock role>` with the Loyiha's client as
partner, adjust `Dt <stock role> Kt other_op_income` (surplus) or `Dt other_op_expense Kt <stock role>`
(shortage); transfer and receipt write none of their own. Stock role = `finished_goods` for `tayyor`,
else `materials`. Lines carry the Loyiha. Cancelling posts the reversing entry. A date on or before the
lock date is refused with 409.

#### Scenario: Delivery posts cost of goods sold
- WHEN a finished window worth 3 000 000 is delivered for a Loyiha
- THEN one entry Dt 9110 3 000 000 · Kt 2810 3 000 000, project = the Loyiha

#### Scenario: Output from work in progress
- WHEN a Loyiha has issues worth 2 500 000 (Dt 2010) and an output of 1 finished product is posted without
  a unit cost
- THEN its amount is 2 500 000, the entry is Dt 2810 · Kt 2010, and the Loyiha's wip balance is 0

#### Scenario: Cancel reverses
- WHEN a posted issue is cancelled with a reason
- THEN a reversing entry is posted, the row is `cancelled` and the stock comes back

### Requirement: Moves list and summary
`GET /inventory/moves/` SHALL filter by type, status (several), warehouse (either side), product,
category, Loyiha, partner, source document and date range, and search code, product, Loyiha and notes.
`GET /inventory/moves/summary/` returns, for the same filters over posted rows, the count and the amounts
of kirim (receipt + output + positive adjust), chiqim (issue + negative adjust), yetkazish (delivery), and
the current stock value.

#### Scenario: Summary follows the filter
- WHEN the list is filtered to one Loyiha
- THEN the summary sums only that Loyiha's rows

### Requirement: Access
The registry SHALL have pages `inventory` (moves), `stock` (view), `products`, `warehouses`. `post` and
`cancel` map to `inventory.update`. Role "Omborchi" gets them; "Ta'minotchi" and "Buxgalter" may view.

#### Scenario: Viewer cannot post
- WHEN a user with only `inventory.view` posts a move
- THEN 403
