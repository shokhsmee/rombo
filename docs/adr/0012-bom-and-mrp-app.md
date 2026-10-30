# ADR 0012 — BOM and MRP live in a leaf app `mrp`

- Status: accepted
- Date: 2026-10-31
- Relates to: ADR 0004 (Loyiha as hub), ADR 0010 (inventory between accounting and procurement)

## Context
BOMs are made of inventory products, Loyiha items must point at a finished product, and MRP needs stock
(inventory), open purchase orders and a way to create purchase requests (procurement).

## Decision
1. New app `apps/mrp` owns `Bom`, `BomLine`, `ItemSpec` (Loyiha item → product), `ProjectMaterial`.
2. Dependency direction: `… ← projects ← accounting ← inventory ← procurement ← mrp`. `mrp` imports the
   services and selectors of those apps; none of them imports `mrp`.
3. The Loyiha card shows materials through `projects.extensions.register_detail_block`; the items editor
   saves the product choice through `mrp`'s endpoint.

## Rejected
- *`product` FK on `ProjectItem`* — the hub would depend on inventory.
- *BOM inside inventory* — MRP needs procurement, and inventory must not import procurement.
