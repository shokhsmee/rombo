# Design: add-procurement

## Suppliers are clients (ADR 0008)
One contragent table; `kind = supplier`. Rejected: a `Supplier` model in procurement — accounting would need
two partner FKs, requisites would be duplicated, a dealer that also supplies would exist twice.

## Request → order → receipt, nothing more
Three documents are the minimum that answers "what did we ask for / what did we order / what arrived".
Rejected:
- *Request and order merged* (buyer orders straight away) — loses the approval step and the per-supplier
  split; one Loyiha needs profile from AKFA and glass from another plant out of one request.
- *Supplier confirmation status* (`sent → confirmed`) — AKFA does not confirm orders, it invoices; the
  buyer would have to click it by hand. The receipt is the confirmation.
- *Separate supplier-invoice document for goods* — in practice the ESF arrives with the goods; the receipt
  carries `invoice_number` / `invoice_date` / `invoice_total` and the accountant fills them. If the ESF total
  differs from the receipt: fix the prices before posting, or reverse and post again. Invoices without goods
  (delivery, services) are `accounting.Invoice(kind = supplier)`.

## The send step
`sent` is a state of the order, not a log line, because the business question is "has this gone to AKFA
yet?". The action stores `sent_at`, `sent_by`, `sent_via` (`print | email | other`) and `sent_to` (address or
free text), and posts "Yuborildi: email → sales@akfa.uz" to chatter. `via = email` renders the same HTML the
print page uses and sends it with Django's email backend; without `EMAIL_HOST` the action answers 409
"Email sozlanmagan" and nothing changes. A sent order can be re-sent (same action, status unchanged,
another chatter line). Editing lines after `sent` is blocked (409); the buyer cancels and makes a new one —
what the supplier has on paper must match the record. Rejected: silent edits plus a "modified after sending"
flag — nobody reads flags.

## Lines keep the chain
`PurchaseOrderLine.request_line` (nullable) and `GoodsReceiptLine.order_line` (required) link the documents.
Quantities are kept on the lines as `ordered_qty` (request line) and `received_qty` (order line), updated by
the services in the same transaction; statuses `ordered`, `partially_received`, `received` are derived from
them. The order header `project` is optional (one AKFA order can serve several Loyihalar); each line inherits
the Loyiha of its request line, so "Xaridlar" on a Loyiha card is a query on lines.

## Prices and currency
Order lines carry `price`, `vat_rate` (default: company VAT rate when the supplier is a VAT payer, else 0);
the header carries `currency` and `rate`. Default price = the last posted receipt price for (supplier, item).
Rejected: a supplier price-list table — AKFA's list moves with the dollar; what buyers trust is the last
invoice. Posting converts to UZS with the header rate (default: accounting rate of the order date).

## Posting a receipt (ADR 0007)
```
Dt materials (role per line category; default 1010)   net
Dt vat_input (4410)                                    VAT, only when vat_rate > 0
   Kt ap_suppliers (6010)                              gross
Dt ap_suppliers (6010)  Kt advance_paid (4310)         min(gross, partner's 4310 balance)
```
One journal entry per receipt, `source = procurement.goodsreceipt`. Cancelling a posted receipt reverses the
entry and rolls back `received_qty`; refused if the order is already cancelled.

## Approval
A separate page key `purchase_approve` (view + update). `approve` maps to `update` on that page. If the
submitter has it, `submit` approves at once — a buyer who is also the director does not click twice.
Rejected: amount thresholds — request lines carry no reliable price yet.

## Loyiha status
`order_send` calls `projects.services.project_change_status(project, status="procurement")` for every
Loyiha of the order's lines that is still `confirmed`. Other statuses are left alone (an order for a Loyiha
already in production is a top-up).
