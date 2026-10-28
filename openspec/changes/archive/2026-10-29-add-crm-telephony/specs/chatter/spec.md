## MODIFIED Requirements

### Requirement: Access
Reading and writing SHALL require `view` permission on the page the model belongs to. Unknown model
or missing record → 404. Models with a history: Loyiha, Mijoz, Xodim, Foydalanuvchi, Rol, **Lid**
(`crm.lead`, page `crm`).

#### Scenario: No access
- WHEN a user without `clients.view` requests the history of a client
- THEN 403

#### Scenario: Calls in a client's history
- WHEN a call with a client's number ends
- THEN an `event` line describing the call is in that client's history
