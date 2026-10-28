# pricing (Narxlar)

## Purpose
Price lists per product series — the template of every hisob-kitob. Implementation: `apps/pricing`, page key `pricing`.

## Requirements

### Requirement: Price list
A price list SHALL have a unique name, optional product type, profile bar length (m), currency (USD/UZS),
active flag and ordered items (name, unit, price ≥ 0, active). Seeded: "Rombo Termo 306J 65 seriya" (38 items).

### Requirement: Access
Every logged-in user SHALL read price lists; changes need the `pricing` page. Changes are written to chatter.

#### Scenario: Sales edits a price
- WHEN a user with only `pricing.view` saves a price list
- THEN 403

### Requirement: Price changes don't re-price orders
Saving a price list SHALL NOT change existing calculations (they keep their snapshot).
