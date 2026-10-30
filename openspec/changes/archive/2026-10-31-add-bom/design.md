# Design: BOM, Loyiha materials and MRP (phases add-bom → add-project-materials → add-mrp)

Status: **proposed — for review**. Nothing here is implemented.

## Where we are (what the code does today)
| Piece | Today | Gap |
|---|---|---|
| Item master | `inventory.Product` (MH-): profil / oyna / furnitura / material / tayyor, unit, average cost, optional link to a price-list item | No "what is this made of" |
| Loyiha items | `ProjectItem`: product **type** (RefItem "Termo"), m², count | Not a real product; no dimensions |
| Hisob-kitob | `ProjectCalc` lines copied from a price list (38 lines for Termo 306J); **sales types every quantity by hand** | Quantities are guessed per order; the same knowledge is retyped every time |
| Purchasing | "Xaridga yuborish" turns the hisob-kitob lines into a purchase request | Buys what sales typed, ignores stock and what is already ordered |
| Stock | Ombor moves, stock per warehouse, chiqim / ishlab chiqarish / yetkazish to a Loyiha | Chiqim is typed product by product |
| MRP | `add-mrp` stub, page `mrp` "planned" | — |

## The idea in one line
**One item master (Mahsulotlar), one BOM per finished product, quantities flow from the Loyiha items through
the BOM into the hisob-kitob, the purchase request and the warehouse chiqim — nobody retypes them.**

```
Mahsulot (tayyor) ── BOM (Tarkib) ── lines: Mahsulot (profil / oyna / furnitura / yarim tayyor) × qty per dona / per m²
        │                                                     │
Loyiha item: product + m² + count (+ width × height later)    └─ yarim tayyor has its own BOM (multi-level)
        │
        ▼ explode
Loyiha materials (frozen when the Loyiha is confirmed)
   ├─► hisob-kitob quantities ("BOM'dan to'ldirish")
   ├─► MRP: need − free stock − on order = to buy  ─► purchase request lines (product-linked)
   └─► "Materiallarni chiqim qilish" ─► draft issue moves for this Loyiha
                                  then Ishlab chiqarish (2810) ─► Yetkazish (9110)
```

## Decisions (with the options rejected)

### D1. The BOM belongs to a finished **product**, not to a product type or a price list
`Bom.product` = a `tayyor` (or new `yarim` = semi-finished) product, e.g. "Termo 306J deraza 2 tabaqali",
"Steklopaket 4-16-4". *Rejected:* BOM per product type ("Termo") — too coarse, a door and a window of the same
series use different fittings. *Rejected:* quantities on the price list — a price list is what we **sell**
at, a BOM is what we **consume**; they change at different times and belong to different people.
The link between them stays the existing `Product.price_item`.

### D2. Quantity rule per line: per piece or per m², plus waste
`BomLine(component, qty, basis = dona | m2, waste_pct)`; requirement = qty × (count or m² × count) × (1 + waste).
This is exactly what a Loyiha item carries today (m² and count). *Deferred:* per perimeter metre and
formula lines (need width × height and sash count on the item — phase 2b); cutting optimisation of 6.5 m bars
(MRP rounds to the bar instead — D6).

### D3. Multi-level, versioned lightly
A component may itself have a BOM (`yarim` category, e.g. a glass unit assembled in-house); explosion recurses
with a cycle check. One **active** BOM per product; editing a BOM used by confirmed Loyihas creates a new
version (`BM-00012 v2`) instead of changing the old one. *Rejected:* full effectivity dates — not needed at
Rombo's size.

### D4. Freeze on confirm
While a Loyiha is a draft its materials are computed live; when it moves to `confirmed` (header lock already
exists) the explosion is stored as `ProjectMaterial` rows. Later BOM edits never change a confirmed order —
the same rule as hisob-kitob prices. A "Qayta hisoblash" button re-explodes on purpose (allowed until the
first chiqim).

### D5. Placement: a new app `mrp` at the leaf (ADR 0012, draft)
`… ← projects ← accounting ← inventory ← procurement ← mrp`. `mrp` owns `Bom`, `BomLine`, `ItemSpec`
(Loyiha item → product, later dimensions) and `ProjectMaterial`; it imports projects, inventory and procurement
services; nothing imports it. The Loyiha card gets its "Materiallar" tab through `projects.extensions`, as
kassa and inventory already do. *Rejected:* a `product` FK on `ProjectItem` — it would make the hub depend on
inventory (ADR 0004). *Rejected:* BOM inside `inventory` — MRP needs procurement (on-order quantities, creating
requests), and inventory must not import procurement (ADR 0010).

### D6. MRP is a calculation, not a document
`need (frozen materials of open Loyihas, by deadline) − free stock − open purchase-order quantity = shortage`,
rounded up to the product's purchase multiple (`Product.order_multiple`, e.g. 6.5 m per profile bar).
No stored plan; the MRP page is a live table. Its action creates **purchase requests** (one per Loyiha,
product-linked lines — the link built in improve-product-selection) that go through the existing approval →
order → KR flow. *Rejected:* hard reservations per Loyiha in v1 — first-come by deadline is enough; a
`reserved` view can come later from the same numbers.

### D7. Cost roll-up
BOM card shows planned cost = Σ component average cost × qty (recursive). After production the real cost is the
Loyiha's 2010 balance (already used by Ishlab chiqarish), so plan vs fact is visible on the Loyiha.

## Phases
| Phase | Change | Delivers | Size |
|---|---|---|---|
| 1 | `add-bom` | `yarim` category, `order_multiple`, BOM + lines, multi-level explosion, cost roll-up, "Tarkib" tab on the product card, BOM Excel import / export, page `bom` | M |
| 2 | `add-project-materials` | Loyiha item → product (`ItemSpec`), "Materiallar" tab (need / issued / remaining per product), freeze on confirm, "BOM'dan to'ldirish" for hisob-kitob, "Xaridga yuborish" from materials, "Materiallarni chiqim qilish" → draft issue moves | M |
| 3 | `add-mrp` (replaces the stub) | MRP page (need / stock / on order / shortage per product with per-Loyiha drill-down), purchase multiple rounding, "Xarid so'rovi yaratish", dashboard shortage KPI | M |
| later | `add-production` | production orders, routings, cutting optimisation, dimension formulas | L |

## Questions for the product owner (answers change the design)
1. **Quantities per m² and per piece — enough for the first version?** Or do you need width × height and
   sash count per item now (profile length really follows the perimeter)?
2. **Which BOMs come first?** Proposal: the products already sold most (Termo 306J window / door), entered by
   the technologist; the 38 price-list lines are the starting component list.
3. **Should the hisob-kitob quantities be filled from the BOM automatically** when a Loyiha item is added
   (still editable), or only on the "BOM'dan to'ldirish" button?
4. **Glass units and other in-house semi-finished goods** — assembled in-house (multi-level BOM + own output)
   or always bought?
5. **Profile purchase unit** — bought in 6.5 m bars (round MRP up) or by the metre?
