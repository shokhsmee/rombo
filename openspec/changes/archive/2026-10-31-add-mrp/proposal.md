# Change: add-mrp  (status: proposed — phase 3 of 3, depends on add-bom and add-project-materials)

Replaces the earlier stub of this change. Decisions: `openspec/changes/add-bom/design.md`.

## Why
Purchasing today buys per Loyiha without looking at stock or at what is already on the way, so the warehouse
fills with leftovers while another order waits. MRP nets all open needs against stock and orders.

## What changes
- **MRP page** (`mrp`, group "Ishlab chiqarish", no longer "planned"): one row per component product —
  need (remaining materials of open Loyihas: confirmed → ready), free stock, on order (sent / partly received
  purchase-order lines linked to the product), shortage = need − stock − on order, rounded up to
  `order_multiple`; drill-down per Loyiha sorted by deadline (first need first served).
- Filters: Loyiha, category, deadline before, only shortages; Excel export.
- **"Xarid so'rovi yaratish"** for the selected shortages: one purchase request per Loyiha with product-linked
  lines, into the existing approval flow.
- **Dashboard**: Ta'minot section gets "Kamomad" (number of short products) linking to the MRP page.
- No stored plan, no reservations in this version (design D6).

## Impact
- Endpoints: `/mrp/plan/` (+ `to-requests`), dashboard selector.
- Registry: `mrp` loses `planned`; Ta'minotchi and Omborchi roles may view it.
