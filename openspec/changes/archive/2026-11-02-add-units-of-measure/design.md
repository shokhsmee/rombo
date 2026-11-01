# Design — add-units-of-measure

## The three "products" and how they connect

| | Narxlar (price-list item) | Ombor mahsuloti (stock product) | Tarkib (BOM) |
|---|---|---|---|
| Table | `pricing.PriceListItem` | `inventory.Product` | `mrp.Bom` + `BomLine` |
| What it is | A **price line** of a sales template: what a component costs per unit, in USD or so'm | A **thing we hold in a warehouse**, with quantity and average cost (MH-00001) | A **recipe**: which stock products, and how much of each, make one finished product |
| Used for | The hisob-kitob (offer to the customer) and purchase-request lines from a calc | Stock moves, receipts, issues to production, valuation in 1010 / 2810 | MRP: Loyiha items × BOM → materials to issue and buy |
| Unit | Text as on the paper template (`шт`, `м`) | Stock unit (`m`, `dona`) | Each line's qty is in its component's stock unit, per piece or per m² |
| Includes services? | Yes (Демонтаж, услуги) | No | No |

The links between them:
- **Product → price-list item** (`Product.price_item`, optional): which price line this stock product is. A goods
  receipt finds the product through it.
- **BOM → product**: the BOM belongs to a finished product (`tayyor`), and its lines point at component products.
- **Loyiha item → product** (`mrp.ItemSpec`): which finished product an order line is. MRP then explodes its BOM.
- **Purchase lines** carry both: `item` (the price line, for price) and `product` (the stock product, for stock).

So a profile is a price line "L-ka, шт, 51.40$" (one 6.5 m bar), a stock product "Profil L, m", and a BOM line
"Deraza 1200×1500: Profil L 4.2 m per dona". The unit registry is what makes "1 шт" and "6.5 m" the same
quantity.

## Decisions
1. **A registry with aliases, not a foreign key on every line.**
   - Request, order, receipt, calc and invoice lines keep their text unit (it is what is printed and what the
     supplier wrote).
   - The registry resolves text (`шт`, `Dona`, `pcs`) to one unit when quantities must be converted.
   - Only `Product.unit` and `purchase_unit` are validated against it.
2. **Product-level purchase unit with a factor**, not one unit per bar length. Profiles come in 6 m and 6.5 m
   bars; "1 dona = 6.5 m" belongs to the product. Within-category ratios (sm → m, g → kg) come from the registry.
3. **Conversion order:**
   - same unit;
   - else the product's purchase unit × factor;
   - else the registry ratio within one category;
   - else refuse.

   There is no guessing across categories.
4. **`order_multiple` folds into the purchase unit.** It meant the same thing ("bought in 6.5 m bars"); two
   fields for one idea confused users.
5. **The registry lives in `references`**, the lowest business app. pricing, inventory, procurement and mrp may
   all read it. Its page uses the "Ma'lumotnomalar" permission.
6. **A unit's name can't change once products use it.** Products store the canonical name; add an alias
   instead.

## Rejected
- *FK `uom` on every document line* — a migration across six tables, and the printed text would still be needed.
- *One unit per bar length (`bar 6.5`)* — a new unit for every profile size.
- *Converting price-list prices* — prices stay per their own unit; only stock quantities convert.
