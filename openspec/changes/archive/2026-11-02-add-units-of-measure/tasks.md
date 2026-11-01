# Tasks

- [x] `references.Uom` model, seed migration, `uom_resolve` / `uom_convert` services, `/references/uoms/` API
- [x] Product: unit validated + normalised, locked after posted moves; `purchase_unit` + `purchase_factor` replace
      `order_multiple` (data migration)
- [x] `inventory.to_stock_qty(product, qty, unit)`; `product_match` compares units through the registry
- [x] Receipt posting converts to stock units; refuses unconvertible units
- [x] MRP: on order / requested in stock units; shortage rounded to purchase units; request lines in purchase unit
- [x] Frontend: O'lchov birliklari page, product form unit pickers, MRP purchase-unit display
- [x] Tests: receipt of bars into metres, unknown unit refused, unit lock, MRP request in bars, alias resolution
- [x] Spec deltas merged, CHANGELOG, archive
