# mrp — delta

## ADDED Requirements

### Requirement: Issue all materials in one step
`POST /mrp/projects/{id}/issue/ {warehouse_id, lines: [{product_id, qty}]}` SHALL create and post one issue
move per line for the Loyiha, each in its own savepoint, and return `done` (move codes) and `failed`
(product, message). Needs inventory create and update.

#### Scenario: Two materials at once, one short
- WHEN profile 33.6 m (70 in stock) and glass 40 m² (22 in stock) are issued together
- THEN the profile issue is posted and the glass line is reported with "Omborda yetarli emas"

### Requirement: Output and delivery in one step
`output {product_id, qty}` SHALL post an output move valued at the Loyiha's work in progress (2010);
`deliver {lines}` SHALL post delivery moves of finished goods. `materials/` lists `finished`: per finished
product of the Loyiha — produced, delivered, in stock.

#### Scenario: Make and deliver the window
- WHEN materials worth 2 000 000 were issued and 1 window is received, then delivered
- THEN the output is 2 000 000 (Dt 2810 Kt 2010) and the delivery posts Dt 9110 Kt 2810 2 000 000
