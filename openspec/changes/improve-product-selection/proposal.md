# Change: improve-product-selection  (status: proposed)

Depends on: `add-inventory`.

## Why
After add-inventory the buyer could not say which warehouse product a purchase line is: the goods
receipt (KR) guessed it by name and unit, created a new product when the spelling differed, and guessed
its category — which then locked, because posted moves fix the account (1010 / 2810). And the move form's
product picker listed every product, including ones with nothing in the warehouse, so finding the finished
window to deliver meant checking Qoldiqlar first.

## What changes
- **Product on purchase lines.** Request and order lines get an optional `product`. Typing a line name
  suggests products (code, unit, stock); picking one fills name and unit. Order lines made from a request
  inherit its product. Free text stays allowed.
- **KR confirm step.** Each draft KR line shows the product it will post to: the line's product, else
  the one found by price-list item / name + unit, else "Yangi mahsulot" with a category select
  (pre-filled with the guess). The storekeeper can pick another product or fix the category before
  posting; posting uses that choice.
- **Picker shows stock.** `GET /inventory/products/` accepts `in_stock=true` (with optional
  `warehouse`) and returns `qty_in_warehouse` when a warehouse is given. Chiqim, yetkazish and
  ko'chirish pickers list only products the chosen warehouse holds, with the quantity next to each.
- Procurement pages may read the product list (pickers).

## Impact
- Tables: `procurement_purchaserequestline.product_id`, `procurement_purchaseorderline.product_id`,
  `procurement_goodsreceiptline.product_id`, `procurement_goodsreceiptline.new_category`.
- Endpoints: line payloads of `/procurement/requests/`, `/orders/`, `/receipts/` (`product_id`,
  `product`, receipt `new_category`, `match`); `/inventory/products/?in_stock=&warehouse=`.
- Pages: request, order and KR forms; inventory move form; `EntitySelect` gains `describe`.
