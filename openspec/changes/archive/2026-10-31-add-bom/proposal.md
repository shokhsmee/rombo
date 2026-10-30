# Change: add-bom  (status: archived 2026-10-31)

Phases: **add-bom** → `add-project-materials` → `add-mrp`. The whole plan and its decisions are in
`design.md` of this change.

## Why
Sales types every quantity of the hisob-kitob by hand from a 38-line price list, purchasing buys what was
typed, and the warehouse issues materials product by product. What a window is made of lives in people's
heads. A bill of materials (BOM, "Tarkib") written once per product lets the Loyiha, purchasing, the
warehouse and MRP all compute the same quantities.

## What changes
- New app `apps/mrp` (ADR 0012, draft) at the leaf of the dependency direction.
- **Mahsulotlar**: new category `yarim` (yarim tayyor — semi-finished, e.g. steklopaket); field
  `order_multiple` (purchase multiple, e.g. 6.5 m per profile bar), used by MRP.
- **BOM** (`Bom`, code `BM-00001`): finished or semi-finished product, name, version, active flag, notes;
  lines (`BomLine`): component product, qty, basis `dona | m2`, waste %, note. One active BOM per product;
  editing a BOM used by a confirmed Loyiha creates a new version.
- **Explosion** service: (product, count, m²) → flat list of leaf components with quantities, recursing
  through `yarim` components, with a cycle check (400 "Tarkib o'zini o'z ichiga oladi").
- **Planned cost** = Σ component average cost (else default cost) × qty, recursive.
- **Pages**: "Tarkib" tab on the product card (lines editor with product picker), BOM list page with list
  tools (Excel export / import of lines, batch activate / archive), page `bom` in the registry
  (group "Ishlab chiqarish"), chatter.

## Impact
- Tables: `mrp_bom`, `mrp_bomline`; `inventory_product.order_multiple`; category choice `yarim`.
- Endpoints: `/mrp/boms/` (+ `explode`, `cost`, `new-version`), product card block.
- No change to postings. Nothing existing is removed.

## Not in this change
Loyiha usage (phase 2), MRP calculation (phase 3), dimension formulas and cutting optimisation (later).
