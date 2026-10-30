# Change: add-dashboard-analytics  (status: proposed)

## Why
Bosh sahifa shows only Loyiha counts and deadlines. The director opens six pages to answer "how are we
doing": what we sold this month, who owes us, what we owe AKFA, how much cash there is, what lies in the
warehouse, what the delivered orders earned. Every number already exists in the ledger and the documents.

## What changes
- `GET /dashboard/` (new app `apps/dashboard`, read-only — it imports other apps' selectors and nothing
  imports it). It returns one section per module **the user may view**, each with KPIs, a 12-month series
  and short lists:
  - **Savdo** (projects): active pipeline amount and count, contracts this month (count / amount),
    overdue, client debt, sales by month, statuses, top clients.
  - **CRM** (leads): open leads and budget, new this month, won / lost this month, win rate, leads by
    month, by stage.
  - **Ta'minot**: requests waiting approval, orders sent / partly received, purchases (KR) by month,
    supplier debt (6010 − 4310), top suppliers.
  - **Moliya** (kassa): money in kassa and bank, kirim / chiqim this month, money in vs out by month,
    pending payment requests.
  - **Buxgalteriya**: revenue (90xx), cost of goods sold (9110), gross margin, AR (4010) and AP (6010),
    revenue vs cost by month.
  - **Ombor**: stock value by category, kirim / chiqim / yetkazish by month, top products by value,
    products with no movement for 60 days.
  - **Xodimlar**: active employees by department.
- Bosh sahifa renders those sections with KPI tiles and plain SVG charts (house tokens, no chart
  library): bars with a hover tooltip, a legend for two or more series, and a "Jadval" toggle showing the
  numbers as a table. Tiles link to the filtered list behind them. The deadline panels stay.

## Impact
- New app `apps/dashboard` (selectors, views, urls, tests); `config/urls.py`, settings.
- Frontend: `modules/dashboard/` (api, page), `components/charts.tsx`, chart tokens in `index.css`.
- No tables, no migrations. Each section needs view on its page; the `dashboard` page as before.
