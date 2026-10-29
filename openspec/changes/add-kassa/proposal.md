# Change: add-kassa  (status: proposed)

Depends on: `add-accounting` (every cash document posts to the ledger; balances are read from it).
Independent of `add-procurement`.

## Why
Roadmap step 3 (docs/process-map.md): Sotuv hands money to Kassa, Kassa pays Zakup, O'rnatish brings the
remainder and the signed act back to Kassa. Today the advance is a number typed on the Loyiha and the real
cash is in the accountant's notebook. The director wants: how much is in each kassa and bank account now,
who paid for which order, what we paid AKFA this month — every number agreeing with the books.

## What changes
New app `apps/kassa`, page group **Moliya**:

- **Kassa va bank** (`CashAccount`): cash desks and bank accounts — name, kind `cash | bank`, currency,
  ledger account (defaults from role: `cash_uzs` 5010, `cash_usd` 5020, `bank_uzs` 5110, `bank_usd` 5210),
  bank requisites, responsible employee (kassir), optional cash limit. **Balance = ledger balance** of that
  account (ADR 0007), shown live on the page, in the account's currency and in UZS.
- **Kirim / chiqim** (`CashOrder`): one document for every movement, `kind` `in | out | transfer`, numbered
  by form — `PKO-00001` / `RKO-00001` for cash desks (prixodniy / rasxodniy kassa orderi), `BK-00001` /
  `BT-00001` for bank receipts and payment orders, `OT-00001` for transfers between accounts. Fields: date,
  account (and `to_account` for transfers), amount, currency, rate, **purpose** (`PaymentPurpose`), partner
  (client or supplier), Loyiha, employee, optional invoice, basis text, received-from / issued-to text.
  Statuses `draft → posted → cancelled` (cancel reverses the entry).
- **Purposes** (`PaymentPurpose`, seeded, editable): "Mijozdan to'lov", "Yetkazib beruvchiga to'lov",
  "Xarajat", "Ish haqi", "Xodimga avans", "Avans qaytarildi", "Ta'sischidan qarz", "Bank xizmati",
  "Soliq to'lovi", "Boshqa kirim", "Boshqa chiqim". A purpose says how to post: `partner_customer`
  (AR then advance), `partner_supplier` (AP then prepayment) or a fixed account role.
- **Postings** (one entry per posted order, see design):
  customer payment `Dt cash Kt 4010` up to the client's debt, rest `Kt 6310`; supplier payment
  `Dt 6010 Kt cash` up to the debt, rest `Dt 4310`; expense `Dt <purpose role> Kt cash`; salary
  `Dt 6710 Kt cash`; transfer `Dt to-account Kt from-account`.
- **No overdraft**: a chiqim larger than the account's balance is refused.
- **Kassa kitobi** (cash book) per account and day: opening, kirim, chiqim, closing, the orders of the day;
  printable PKO / RKO forms.
- **Loyiha**: smart button "To'lovlar"; `advance_amount` and `advance_date` become **derived** from posted
  customer payments of the Loyiha once there is at least one (the same rule as amount from calculations);
  the card's "To'lov qo'shish" opens a kirim pre-filled with client, Loyiha and the remaining debt.

## Out of scope (own changes later)
Bank statement import (1C / bank API); POS terminal acquiring (5510); currency exchange between own
accounts (rate gains on 5020 → 5110); petty-cash advance reports (avans hisoboti) beyond the 4220 posting;
installment schedules.

## Impact
- New app `apps/kassa` (imports accounting, clients, projects, employees). Tables: `kassa_cashaccount`,
  `kassa_paymentpurpose`, `kassa_cashorder`.
- Pages: `kassa` (accounts and balances; view, create, update), `cash_orders` (view, create, update =
  post / cancel, delete = drafts only), `cash_book` (view).
- `projects`: `advance_amount` / `advance_date` derived when payments exist; `payments` block on detail.
- Endpoints `/api/v1/kassa/`: `accounts/`, `purposes/`, `orders/` (+ `post/ cancel/`), `book/`,
  `summary/` (balances of every account).
- Frontend `src/modules/kassa/`: KassaPage (accounts with balances, KPI row), CashOrdersListPage,
  CashOrderFormPage (post / cancel, print), CashBookPage, print/CashOrderPrint; Loyiha card "To'lovlar".
- Spec deltas: new `kassa`; `projects` (advance derived, payments block).
