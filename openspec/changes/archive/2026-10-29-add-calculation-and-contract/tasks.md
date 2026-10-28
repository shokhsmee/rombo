# Tasks: add-calculation-and-contract

## Backend
- [x] apps/pricing: PriceList, PriceListItem, CRUD, seed "Rombo Termo 306J 65 seriya" (38 items)
- [x] apps/company: singleton requisites, GET/PATCH, seed Rombo Group
- [x] projects: ProjectCalc + lines (snapshot, rounding), refresh prices, amount derivation, usd_rate,
      advance_date, spec fields; client passport
- [x] chatter events for calculations
- [x] tests: sample invoice total 1 080, amount conversion, snapshot vs price change, permissions

## Frontend
- [x] Loyiha card: Hisob-kitob section, spec fields, USD rate, advance date; amount read-only with calcs
- [x] Calculation editor page
- [x] Print: hisob-kitob, shartnoma
- [x] Settings: Narxlar, Kompaniya

## Docs
- [x] docs/process-map.md, roadmap, archive, specs, CHANGELOG

## Verified
- 29 backend tests (6 new), incl. the sample sheet total 1 080 and 1 080 × 12 000 = 12 960 000.
- Browser: new hisob-kitob from the price list, sample quantities → 1 080 USD live, saved; USD rate on the order
  → amount 12 960 000 with chatter lines; invoice print in the sheet layout; contract print filled; Narxlar and
  Kompaniya pages.
