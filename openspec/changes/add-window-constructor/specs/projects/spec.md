## ADDED Requirements

### Requirement: Hisob-kitob from constructions
"Chizmadan to'ldirish" on a calculation SHALL set the quantity of every calc line whose price-list item is
mapped in the constructions' profile systems: bars from the Loyiha's cut plan for `bars`, summed m² / m / pcs
for the other rules (metre items × (1 + waste % / 100)). Those lines get `source = chizma`; lines with
`source = qo'lda` keep their quantity. Line sums, rounding, total and amount follow "Hisob-kitob (calculation)"
and "Amount from calculations". It is written to chatter.

#### Scenario: Two bars of L-ka
- WHEN the cut plan needs 2 bars of "L -ka" (51.4) and the calc has a manual "Демонтаж" 1 × 10
- THEN "L -ka" becomes 2 → 103, source chizma, and "Демонтаж" stays 1 → 10

#### Scenario: Mapped item missing from the calc
- WHEN the engine needs "Стекло пакет колонний" but the calc has no line for that item
- THEN a line is added from the price list with the quantity, source chizma

### Requirement: Order lines from constructions
When a Loyiha has constructions its lines SHALL be derived from them (product type, area m² × count, count)
and saving `items` directly SHALL be refused; without constructions lines work as before.

#### Scenario: Items follow constructions
- WHEN a Loyiha has constructions Termo 1.68 m² × 4 and Termo 2.1 m² × 1
- THEN its lines total 8.82 m² and 5 pieces, and `PUT items` returns 409
