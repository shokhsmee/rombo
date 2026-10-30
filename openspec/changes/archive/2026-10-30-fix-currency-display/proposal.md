# Change: fix-currency-display  (status: proposed)

## Why
A Loyiha priced in USD shows its Buxgalteriya block in so'm (ledger currency) next to USD fields, the debt
"5 986,38 USD" renders as "5 986 38 USD" (the formatter strips the decimal comma), and "To'lov qo'shish"
prefills the USD debt as a so'm amount because the default kassa is a so'm kassa. Multi-currency must read
as one story: the Loyiha currency first, the so'm equivalent beside it, and payments in the account's currency.

## What changes
- `fmtMoney` / `fmtArea` keep the decimal comma; only the grouping no-break space becomes a plain space.
- `accounting.selectors.project_money` also returns `currency` (the Loyiha's), `rate` (the Loyiha's
  `usd_rate`, else the accounting rate of today) and `invoiced_cur`, `paid_cur`, `debt_cur` when the Loyiha
  is not in so'm. The Loyiha card shows the Buxgalteriya figures in the Loyiha currency with the so'm amount
  beside them, and labels every figure with its currency.
- "To'lov qo'shish" passes `currency` and `rate`; the kirim form picks the first active account in that
  currency; when none exists it converts the amount to so'm with the rate and says so under the amount.
- `seed_kassa` adds "Valyuta kassasi" (USD, account 5020) so dollar payments can be received at once.

## Impact
Frontend `lib/format.ts`, `modules/projects/ProjectFormPage.tsx`, `modules/kassa/CashOrderFormPage.tsx`;
backend `accounting/selectors.py` (`project_money`), `kassa/management/commands/seed_kassa.py`.
Spec deltas: `projects` (MODIFIED "Money from the ledger"), `kassa` (MODIFIED "Cash account" seed note).
