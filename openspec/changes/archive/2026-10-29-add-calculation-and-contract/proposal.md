# Change: add-calculation-and-contract

## Why
The client's price comes from the **hisob-kitob varaqasi** (Счет фактура): a per-series price list of
components (profiles, glass, seals, accessories, services) with quantities. Sales fills it in Excel today
and then writes a **shartnoma** (contract) by hand in Word from the same numbers. Both belong on the Loyiha:
one source of truth for price, and later the material list for purchasing and MRP (see docs/process-map.md).

## What changes
- **pricing** (new app): price lists per series ("Rombo Termo 306J 65 seriya", bar 6.5 m, USD) with items
  (name, unit, price). Settings page "Narxlar". Seeded with the 38 items of the sample invoice.
- **Hisob-kitob on the Loyiha**: `ProjectCalc` made from a price list; lines copy name/unit/price at that
  moment (prices are valid "на дату коммерческого предложения"); sales enters quantities.
  Line sum = qty × price rounded half-up to whole units; total = Σ line sums (sample: 1 080).
- **Order amount comes from the calculations**: when a Loyiha has calculations, `amount` is computed —
  Σ totals, converted with the Loyiha's `usd_rate` when the Loyiha is in so'm. Manual amount only without them.
- **Loyiha fields for the contract**: `usd_rate`, `advance_date`, and the product spec block of the contract
  (profile color, door accessory, window accessory, windowsill, glass type/color, shotlandka).
  Profile type = the calculation's price list / order lines. Client gets `passport` and `address` is used.
- **Company requisites** (new, singleton): name, director, city, address, account, INN, MFO, phone —
  printed on the contract. Settings page "Kompaniya".
- **Print documents** (browser print → PDF): hisob-kitob in the sample's layout; shartnoma with the sample's
  text filled from the Loyiha, client and company.

## Impact
- New apps `pricing`, `company`; tables `pricing_pricelist`, `pricing_pricelistitem`, `company_company`,
  `projects_projectcalc`, `projects_projectcalcline`; new columns on project and client.
- Page keys `pricing`, `company`.
- Spec deltas: projects (calculation, amount rule, contract fields), clients (passport), new pricing, company.
