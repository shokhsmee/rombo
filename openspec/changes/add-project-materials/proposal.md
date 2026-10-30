# Change: add-project-materials  (status: proposed — phase 2 of 3, depends on add-bom)

## Why
With BOMs in place, a Loyiha can know its own material list instead of sales typing it into the hisob-kitob
and the warehouse retyping it as chiqim.

## What changes
- **Loyiha item → product** (`mrp.ItemSpec`: one per `ProjectItem`, the finished product it means; width and
  height reserved for later formulas). The Loyiha items editor gets a product picker (finished products with
  an active BOM), filtered by the item's product type. The hub keeps no FK to inventory (ADR 0004 / 0012).
- **Materiallar tab** on the Loyiha card (block from `projects.extensions`): per component — need, issued
  (posted chiqim), remaining, in stock, planned cost; total planned cost vs the Loyiha's 2010 balance.
- **Freeze on confirm**: when the Loyiha becomes `confirmed`, the explosion is stored as `ProjectMaterial`
  rows; "Qayta hisoblash" re-explodes on purpose until the first chiqim.
- **Hisob-kitob from BOM**: "BOM'dan to'ldirish" sets calc line quantities from the materials, matched through
  `Product.price_item`; unmatched materials are listed so sales can add them.
- **Purchasing from materials**: "Xaridga yuborish" creates a purchase request from the remaining materials
  (product-linked lines) instead of the calc lines.
- **Chiqim from materials**: "Materiallarni chiqim qilish" creates draft issue moves for the remaining
  quantities (one per product, chosen warehouse); the storekeeper corrects and batch-posts them.

## Impact
- Tables: `mrp_itemspec`, `mrp_projectmaterial`.
- Endpoints: `/mrp/projects/{id}/materials/` (+ `freeze`, `fill-calc`, `to-request`, `to-issue`).
- Changed behaviour: "Xaridga yuborish" on a Loyiha with materials uses them (calc lines otherwise).
