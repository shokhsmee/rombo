# inventory — delta

## ADDED Requirements

### Requirement: Stock-aware product list
`GET /inventory/products/` SHALL accept `in_stock=true` (products with quantity > 0, in `warehouse` when
given, else in any warehouse) and return `qty_in_warehouse` when `warehouse` is given. Request, order and
receipt pages may read the list.

#### Scenario: Only what the warehouse holds
- WHEN product A has 5 in "Asosiy ombor", product B has 3 in "Sex ombori" and C has none
- THEN `?in_stock=true&warehouse=<Asosiy>` returns only A with `qty_in_warehouse = 5`
