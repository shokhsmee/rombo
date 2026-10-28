# Change: add-mrp  (status: proposed — not started, depends on add-procurement)

## Why
Material needs for each Loyiha (profile metres, glass m², accessories) are calculated by hand.
Errors cause shortages in the workshop or overstock. MRP computes needs from what is being
produced, compares with stock and creates purchase requests for the gap.

## What changes (draft)
- **Material catalogue** — items with unit of measure, profile system, colour, waste %.
- **Loyiha items** — products in the order (window type, dimensions, quantity, system/colour).
- **BOM rules** — per product type: how much of each material per unit/dimension.
- **MRP run** — explode Loyiha items → gross requirements → minus stock/reserved/on-order →
  net requirements → purchase request lines (procurement) linked to the Loyiha.
- Loyiha header lock (already enforced) guarantees the plan isn't silently invalidated.

## Open questions
- Is cutting optimisation (profile 6 m bars) part of MRP or a separate production step?
- Where does stock live — warehouse module first, or a simple balance table?
