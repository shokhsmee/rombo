# clients — delta

## MODIFIED Requirements

### Requirement: Client record
A client SHALL have: auto code `MJ-NNNNN`; kind `individual | company | dealer | supplier`; name (≥ 2 chars); TIN (9–14 digits,
unique among active clients); contact person; two phones; email; region; address; location; source; notes;
active flag; manager (employee). Companies, dealers and suppliers MAY have bank account, bank name and MFO;
suppliers MAY have `price_currency` (`UZS | USD`), `prepay_percent` (0–100) and `credit_days`.
`GET /clients/` hides `supplier` unless `kind=supplier` is asked for.

#### Scenario: Duplicate TIN
- WHEN saving a client with an existing TIN
- THEN 409 on field `tin`

#### Scenario: Suppliers stay out of the sales list
- WHEN listing clients without a `kind` filter
- THEN suppliers are not returned; WHEN `kind=supplier` THEN only suppliers are
