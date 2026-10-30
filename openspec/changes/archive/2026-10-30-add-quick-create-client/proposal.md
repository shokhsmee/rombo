# Change: add-quick-create-client  (status: proposed)

## Why
Sales opens a Loyiha for a caller who is not in Mijozlar yet. Today they leave the form, create the client on
its own page, come back and search for it. Odoo's many2one does this inline: type the name, pick
"Create «name»" or "Create and edit…", and continue.

## What changes
- `EntitySelect` gains an optional `onCreate(query)` and `onCreateEdit(query)`: when the typed text has no
  exact match, the dropdown ends with "«Ali Valiyev» yaratish" and "Yaratish va to'ldirish…".
- Loyiha form, Mijoz field: "yaratish" posts `POST /clients/ {name}` (kind individual) and selects the new
  client; "Yaratish va to'ldirish…" opens a dialog with the short client form (kind, name, phone, region,
  address, STIR for companies); saving creates the client and selects it. Permission: `clients.create`;
  without it the options are hidden.
- Frontend only; no backend change (`POST /clients/` already accepts a bare name).

## Impact
- `frontend/src/components/EntitySelect.tsx`, `frontend/src/modules/clients/QuickCreateClient.tsx` (new),
  `frontend/src/modules/projects/ProjectFormPage.tsx`.
- Spec delta: `projects` (ADDED requirement "Create the client from the Loyiha form").
