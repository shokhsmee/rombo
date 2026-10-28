# projects — delta

## ADDED Requirements

### Requirement: Order card fields
A project SHALL also hold: sale date, service amount, advance amount, phone, partner (a client of kind
dealer/partner), sales channel, brand and product name, location, mosquito net (yes/no), dismantling (yes/no).

#### Scenario: Debt
- WHEN amount = 10 000 000, service = 1 500 000, advance = 4 000 000
- THEN `debt_amount` = 7 500 000 and `total_amount` = 11 500 000

### Requirement: Order lines
A project SHALL have lines `(product_type, area_m2 > 0, quantity ≥ 1)`. Saving `items` replaces all lines.
`total_area` and `total_quantity` are the sums. A line change is written to chatter.

#### Scenario: Lines totals
- WHEN lines are Termo 12.5 m² × 4 and PVX 8 m² × 3
- THEN total_area = 20.5 and total_quantity = 7

### Requirement: Drawings
Users with `projects.update` SHALL upload files (pdf, images, dwg, dxf, zip; ≤ 25 MB) to a project and
delete them; users with `projects.view` SHALL download them through the API. Uploads go to chatter.

#### Scenario: Wrong type
- WHEN uploading `virus.exe`
- THEN 400 on field `file`

## MODIFIED Requirements

### Requirement: Header lock
From `procurement` on, only production fields SHALL be locked: client, name, lines, brand, product name,
mosquito net, dismantling. Money, phone, dates, location, partner, channel and notes stay editable.

#### Scenario: Advance in production
- WHEN a project in `production` gets a new advance amount
- THEN it is saved and tracked in chatter

#### Scenario: Lines in production
- WHEN a project in `production` gets new lines
- THEN 409
