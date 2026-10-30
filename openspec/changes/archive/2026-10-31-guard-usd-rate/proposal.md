# Change: guard-usd-rate  (status: archived 2026-10-31)

## Why
LY-26-00008 carried "USD kursi" 119 990 instead of 11 999; the contract then printed 48 000 000 so'm as 400$.
A typo in the rate silently changes every dollar figure of the Loyiha.

## What changes
- The Loyiha's USD rate must be within 1 000 – 50 000 so'm per dollar (`projects.models.USD_RATE_RANGE`);
  outside it the API answers 400 on `usd_rate` and the form shows the same message before saving.
- Printed contract amounts keep their thousands together (no line break inside "4 003$").
- Data: LY-26-00008's rate corrected to 11 999 (through the normal update, logged in its history).

## Impact
`projects/services.py`, `projects/models.py`, Loyiha form, contract print. No migration.
