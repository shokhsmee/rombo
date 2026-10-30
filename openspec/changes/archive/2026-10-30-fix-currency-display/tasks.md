# Tasks: fix-currency-display

- [x] `fmtMoney` keeps decimals ("5 986,38 USD"); same for `fmtArea`, the order print and CRM number fields
- [x] `project_money`: `currency`, `rate`, `*_cur` fields (+ test)
- [x] Loyiha card money block: Loyiha currency first, so'm beside, currency on every figure
- [x] "To'lov qo'shish" → `currency` + `rate`; kirim form picks the account by currency or converts with a hint
- [x] `seed_kassa`: "Valyuta kassasi" USD → 5020
- [x] Browser check on a USD Loyiha; `npm run build`; backend tests; archive; CHANGELOG
