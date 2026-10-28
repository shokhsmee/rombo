# Design: add-loyiha-card-fields

## Lookups: one generic table vs. a table per list
Chosen: `RefItem(kind, name, sort_order, is_active)`. Sales channels, brands, segments and product types
are short, admin-edited lists with no behaviour of their own. One table + one settings page covers all,
and a new list is one enum value.
Rejected: hard-coded choices — every new channel or brand would need a developer.
Rejected: a model per list — four tables, four endpoints, four pages for the same shape.
If a list grows behaviour (e.g. product type gets a BOM for MRP) it graduates to its own model then.

## Order type + area: lines, not columns
The card says each order type needs its own area. Columns like `termo_m2`, `pvx_m2` would need a migration
for every new type. Lines (`ProjectItem`) scale and are exactly what MRP will explode later.
Totals (`total_area`, `total_quantity`) are computed, never stored, so they can't drift.

## Debt is computed
`debt_amount = amount + service_amount − advance_amount`. Stored debt would drift from its inputs.
When payments arrive (finance module) `advance_amount` becomes the sum of payments; the formula stays.

## Segment belongs to the client
A segment (Ekonom/Standart/Premium/VIP) describes the customer, not one order. Kept on `Client`, shown
read-only on the order card with a link to edit it.

## Drawings
`ProjectFile` with Django `FileField` under `MEDIA_ROOT/projects/YYYY/MM/`. Downloads go through an
authenticated endpoint (`projects.view`), never a public media URL — drawings are customer data.
Allowed: pdf, images, dwg/dxf, zip; ≤ 25 MB. Files can be added in any status (drawings get revised).

## Lock refinement
Old rule locked the whole header from `procurement` on. Real life: the advance and the debt change while
the order is in production, phones change, deadlines move. New rule locks only what production depends on.

## Assumptions to confirm with sales
- "№ заказа" = our generated code. If sales has its own numbers (old system), add `external_number`.
- Default lists are guesses (channels, brands, segments) — edited in Sozlamalar → Ma'lumotnomalar.
