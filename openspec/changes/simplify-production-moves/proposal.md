# Change: simplify-production-moves  (status: proposed)

## Why
On the Loyiha card, "Ombor → Chiqim" opens the generic move form for **one** product: the storekeeper picks
the product, the warehouse and the quantity, saves, then posts — and repeats that for every profile, glass and
fitting of the order. Users did not understand what the menu does, and it is slow.

## What changes
Three one-step dialogs on the Loyiha card, in the order the work happens (menu "Ishlab chiqarish"):
1. **Materiallarni berish** (issue to production): every remaining material of the Loyiha is listed with the
   quantity to give = min(remaining, stock in the chosen warehouse), editable, with a checkbox; extra products
   can be added. One button issues all ticked lines (posted at once, Dt 2010 Kt 1010); lines that fail
   (not enough stock) are reported and the rest go through.
2. **Tayyor mahsulotni qabul qilish** (output): the Loyiha's finished products (from its items) with their
   counts; cost is taken from the Loyiha's work in progress (2010) automatically, split by count.
3. **Mijozga yetkazish** (delivery): the finished products made for this Loyiha and still in stock,
   pre-filled; one button delivers them (Dt 9110 Kt 2810).

Each dialog says in one line what will happen. The detailed move form stays reachable from the dialog.
"Chiqim qoralamalari" on the Materiallar panel becomes "Materiallarni berish".

## Impact
- Endpoints: `/mrp/projects/{id}/issue/`, `/output/`, `/deliver/`; `materials/?warehouse=` returns stock in
  that warehouse and the Loyiha's finished goods (`finished`).
- Permissions: inventory create + update (the same as creating and posting a move).
- Frontend: `modules/mrp/ProductionDialogs.tsx`, Loyiha card menu, Materiallar panel.
