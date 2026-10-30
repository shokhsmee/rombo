# projects — delta

## ADDED Requirements

### Requirement: Plausible USD rate
A Loyiha's `usd_rate` SHALL be empty or within 1 000 – 50 000 so'm per dollar; anything else is refused with
400 on `usd_rate`.

#### Scenario: Extra digit refused
- WHEN a Loyiha is saved with USD rate 119 990
- THEN 400 on `usd_rate` with a hint like "masalan 12 000"
