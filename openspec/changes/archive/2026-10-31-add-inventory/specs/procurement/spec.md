# procurement — delta

## MODIFIED Requirements

### Requirement: Goods receipt
A receipt SHALL have code `KR-NNNNN`, order, supplier (from the order), date, storekeeper, **warehouse**
(default warehouse when empty), supplier ESF fields (`invoice_number`, `invoice_date`, `invoice_total`),
notes and lines (`order_line`, `qty > 0`, price copied from the order line, `vat_rate`). "Kirim qilish" on
an order pre-fills the remaining quantities. A line cannot receive more than the order line's remaining
quantity. Statuses: `draft → posted`, `posted → cancelled`. Posting creates one posted inventory kirim row
per line (product resolved by price-list item, else name and unit, else created), valued at the line's net
in UZS, and debits the product's stock role. Cancelling cancels those rows.

#### Scenario: Over-receipt
- WHEN a receipt line's qty exceeds `ordered − received`
- THEN 400 on field `lines`

#### Scenario: Posting writes the ledger
- WHEN a receipt of 100 bars × 20 USD at rate 12 000, VAT 12 %, is posted
- THEN one journal entry: Dt 1010 24 000 000 · Dt 4410 2 880 000 · Kt 6010 26 880 000, partner = supplier,
  project = the line's Loyiha, and the order line's `received_qty` = 100

#### Scenario: Posting fills the warehouse
- WHEN the same receipt is posted into "Asosiy ombor"
- THEN one posted kirim row: product "Profil", qty 100, amount 24 000 000, source = the KR, and the stock
  of the product in that warehouse is 100

#### Scenario: Prepayment offset
- WHEN the supplier has a 4310 balance of 10 000 000 and a receipt of 26 880 000 is posted
- THEN the same entry also has Dt 6010 Kt 4310 10 000 000, and the supplier balance is 16 880 000

#### Scenario: Cancel a posted receipt
- WHEN a posted receipt is cancelled
- THEN a reversing entry is posted, `received_qty` is rolled back, its kirim rows are cancelled and the
  order status is derived again

#### Scenario: Cancel after the goods were used
- WHEN part of the received quantity has been issued and the receipt is cancelled
- THEN 409 and nothing changes

#### Scenario: Closed period
- WHEN posting with a date on or before the accounting lock date
- THEN 409
