# company — delta

## MODIFIED Requirements

### Requirement: Requisites
The system SHALL keep: name, legal form, director (full and short), city, address, bank account, bank, MFO, INN,
phone, prepayment % and delivery term (bank days). Seeded with Rombo Group from the contract sample.
It SHALL also keep the accounting settings: `vat_payer` (bool, default false), `vat_code` (QQS
registration code, printed on invoices), `vat_rate` (default 12), `lock_date` (date or null).
Every user reads them; changes need `company.update`.

#### Scenario: VAT off
- WHEN `vat_payer` is false
- THEN new invoices get `vat_rate = 0` and no VAT line is posted
