# Tasks: add-kassa

## Backend
- [x] apps/kassa: models CashAccount, PaymentPurpose, CashOrder (+ per-prefix sequence), TRANSITIONS,
      TRACK; seed purposes and two accounts ("Asosiy kassa" UZS, "Hisob raqami" UZS)
- [x] services: cash_account_create/update; cash_order_create/update/post/cancel/delete (posting table,
      AR/AP capping, invoice cap, no overdraft, rate); purpose CRUD
- [x] selectors: account balances (ledger), cash book, payments per Loyiha / partner
- [x] serializers + views + urls; registry pages kassa, cash_orders, cash_book; `CHATTER_PAGES`
- [x] projects: derived `advance_amount` / `advance_date`, `payments` block, "To'lov qo'shish" prefill data
- [x] migrations: `makemigrations kassa -n initial`
- [x] tests: every purpose posts the expected Dt/Kt; customer payment splits AR / advance; supplier
      payment splits AP / prepayment; invoice cap; overdraft 409; cancel reverses; transfer; USD kassa at
      rate; Loyiha advance derived; cash book totals; permissions; number prefixes per form

## Frontend
- [x] `src/modules/kassa/`: api.ts, KassaPage (accounts, balances, KPI), CashOrdersListPage (filters:
      account, kind, purpose, partner, Loyiha, date), CashOrderFormPage (post / cancel / print),
      CashBookPage, print/CashOrderPrint (PKO / RKO forms)
- [x] Loyiha card: smart button "To'lovlar", "To'lov qo'shish", advance read-only once derived
- [x] Supplier / client card: "To'lovlar" smart button
- [x] nav group Moliya

## Docs
- [x] project.md roadmap, archive, merge spec deltas, CHANGELOG
