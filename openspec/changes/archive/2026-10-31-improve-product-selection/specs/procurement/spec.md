# procurement — delta

## ADDED Requirements

### Requirement: Product on purchase lines
Request and order lines SHALL carry an optional warehouse `product`; choosing it fills name and unit.
Order lines created from request lines inherit the product. A goods receipt line takes the order line's
product unless another is chosen on the receipt.

#### Scenario: Chosen product is used by the receipt
- WHEN a request line names "Profil 60" but has product MH-00001 "Profil Rombo Termo 60 mm", and its order
  is received and posted
- THEN the kirim row is for MH-00001 and no new product is created

### Requirement: Product confirmation on the goods receipt
A draft receipt line SHALL expose `match`: the product it would post to (line product, else found by
price-list item, else by name and unit) or none with a guessed `category`. The line accepts `product_id`
and `new_category`; posting creates a missing product with `new_category` (else the guess).

#### Scenario: Category fixed before posting
- WHEN a receipt line for an unknown item "Deraza tayyor" gets `new_category = tayyor` and is posted
- THEN the new product's category is `tayyor` and the line debits 2810
