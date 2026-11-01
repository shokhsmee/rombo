# Change: add-units-of-measure  (status: archived 2026-11-02)

## Why
Units are free text and in two languages:
- Price-list items use Russian (`шт`, `м`, `м2`, `компл`, `кг`), and profiles are priced per `шт`: one 6.5 m bar.
- Stock products use Latin (`dona`, `m`, `m2`).
- Purchase lines copy whichever text they came from.

Nothing converts between them. A goods receipt of "10 шт" profile books **10 m** into a product kept in metres;
the right figure is 65 m (audit 2026-11-01 #25). MRP adds bars to metres the same way when it counts what is on
order. A product's unit can also be changed after stock exists, which silently relabels it.

## What changes
- **Units of measure registry** (`references.Uom`, page "O'lchov birliklari" under Sozlamalar):
  - each unit has a name (`dona`, `m`, `m2`, `kg`, …), a category (count / length / area / weight / volume /
    other), a ratio to its category's base unit (`sm` = 0.01 m), and aliases (`шт, ta, pcs` → `dona`);
  - seeded with the units in use; units in "other" (`komplekt`, `pachka`, `xizmat`) convert only to themselves.
- **Product units:**
  - `Product.unit` must be a registered unit, stored by its canonical name (`шт` → `dona`).
  - It can't change once the product has posted stock moves.
  - New `purchase_unit` + `purchase_factor` = how the supplier sells it (1 dona = 6.5 m). They replace "Xarid
    karrasi" (`order_multiple`); the migration turns `order_multiple = 6.5` into "dona, 6.5".
- **Conversion where stock is touched:**
  - goods receipt posting converts each line from its unit to the product's stock unit (purchase unit × factor,
    or the ratio within a category); a unit that can't be converted is refused with the product and both units
    named;
  - MRP converts open order and request lines to stock units, rounds a shortage up to whole purchase units, and
    creates request lines in the purchase unit (bars, not metres);
  - matching a purchase line to an existing product compares units through the registry, not as text.
- Documents keep their text unit as printed; nothing about hisob-kitob, invoices or prints changes.

## Impact
- Apps: `references` (model, seed, service, API), `inventory` (product fields, conversion, match), `procurement`
  (receipt posting), `mrp` (plan, requests).
- Migrations:
  - references 0003: `Uom` + seed;
  - inventory 0003: `purchase_unit`, `purchase_factor`, data from `order_multiple`, unit normalised, drop
    `order_multiple`.
- API: `GET/POST/PATCH/DELETE /references/uoms/`. Product gains `purchase_unit` and `purchase_factor`, and loses
  `order_multiple`. MRP rows show `purchase_unit` / `purchase_factor`.
- Frontend: new page Sozlamalar → O'lchov birliklari; product form unit pickers; MRP shows "to buy" in purchase
  units too.
