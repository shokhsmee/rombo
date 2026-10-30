# kassa — delta

## MODIFIED Requirements

### Requirement: Cash account
A cash account SHALL have name, kind `cash | bank`, currency `UZS | USD`, ledger account (a 5xxx account
with `allow_posting`; default by kind and currency from the roles), bank name / MFO / account number for
banks, responsible employee, optional `cash_limit`, active flag. `GET /kassa/accounts/` returns each with
`balance` (account currency) and `balance_uzs` from the ledger; `GET /kassa/summary/` returns the totals.
An account with posted orders cannot be deleted, only deactivated. The seed creates three accounts when
there are none: "Asosiy kassa" (UZS, 5010), "Valyuta kassasi" (USD, 5020) and "Hisob raqami" (UZS bank,
5110), so dollar-priced orders can be paid in dollars from day one.

#### Scenario: Balance is the ledger
- WHEN a kassa has posted kirim 5 000 000 and chiqim 1 200 000
- THEN `balance = 3 800 000`, equal to the ledger balance of its account

#### Scenario: Seeded accounts
- WHEN `seed_kassa` runs on an empty database
- THEN the accounts are Asosiy kassa (5010), Valyuta kassasi (5020) and Hisob raqami (5110), and running
  it again adds nothing
