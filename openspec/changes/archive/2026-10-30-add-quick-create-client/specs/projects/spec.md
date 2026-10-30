# projects — delta

## ADDED Requirements

### Requirement: Create the client from the Loyiha form
When the typed text in the Mijoz picker has no exact match, the picker SHALL offer "«<text>» yaratish"
(creates an individual client with that name and selects it) and "Yaratish va to'ldirish…" (opens a dialog
with kind, name, phone, region, address and STIR; saving creates the client and selects it). Both need
`clients.create`; without it the options are not shown.

#### Scenario: Quick create
- WHEN a user with `clients.create` types "Ali Valiyev" in the Mijoz field and picks "«Ali Valiyev» yaratish"
- THEN a client "Ali Valiyev" of kind individual exists and is selected on the form

#### Scenario: Create and edit
- WHEN the user picks "Yaratish va to'ldirish…", fills phone and region, and saves
- THEN the dialog closes and the new client is selected; a validation error (name too short) is shown in the dialog

#### Scenario: No permission
- WHEN a user without `clients.create` types an unknown name
- THEN only "Topilmadi" is shown
