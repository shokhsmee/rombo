# dashboard Specification

## Purpose
Bosh sahifa: one section per module the user may view, with KPIs, 12-month series and lists, read from
the ledger and the documents (add-dashboard-analytics).

## Requirements

### Requirement: Dashboard by module
`GET /dashboard/` SHALL return `sections`, one per module whose page the user may view (projects → sales,
crm → crm, procurement or purchase_orders → procurement, kassa → finance, accounting_reports →
accounting, stock → inventory, employees → hr). Each section has `kpis` (key, label, value, unit, link),
`series` (12 months: `month` plus values) and lists. Money is UZS from the ledger or the documents, as
strings.

#### Scenario: Sections follow permissions
- WHEN a user may view only `projects` and `stock`
- THEN the response has only the `sales` and `inventory` sections

#### Scenario: Ledger numbers
- WHEN this month a delivery of 2 500 000 was posted (Dt 9110) and revenue of 4 000 000 net (Kt 9010)
- THEN the accounting section shows revenue 4 000 000, cost 2 500 000 and gross margin 1 500 000

#### Scenario: Stock by category
- WHEN 20 m of profile worth 900 000 and 2 doors worth 4 800 000 are in stock
- THEN the inventory section's `by_category` has profil 900 000 and tayyor 4 800 000
