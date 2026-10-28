# company (Kompaniya rekvizitlari)

## Purpose
The seller's requisites printed on contracts and invoices. One row. Implementation: `apps/company`, page key `company`.

## Requirements

### Requirement: Requisites
The system SHALL keep: name, legal form, director (full and short), city, address, bank account, bank, MFO, INN,
phone, prepayment % and delivery term (bank days). Seeded with Rombo Group from the contract sample.
Every user reads them; changes need `company.update`.
