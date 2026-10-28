# chatter — delta

## ADDED Requirements

### Requirement: Record history
Every record of a tracked model SHALL have a history of messages of kind `note` (written by a person),
`event` (written by the system or a service) or `track` (field changes `[{field, label, old, new}]`),
each with author name, user and time, newest first.

#### Scenario: Record created
- WHEN a tracked record is created
- THEN a message "<Name> yaratildi" is added

#### Scenario: Tracked field changed
- WHEN a field listed in the model's `TRACK` changes
- THEN one `track` message lists every changed field with old and new values as people read them
  (choice labels, related names, dates `DD.MM.YYYY`)

#### Scenario: Untracked field changed
- WHEN only fields outside `TRACK` change
- THEN no message is written

#### Scenario: History never breaks a save
- WHEN writing a message fails
- THEN the business save still succeeds and the error is logged

### Requirement: Notes
`POST /chatter/ {model, res_id, body}` SHALL add a `note` by the current user. Empty body → 400.

### Requirement: Access
Reading and writing SHALL require `view` permission on the page the model belongs to. Unknown model
or missing record → 404.

#### Scenario: No access
- WHEN a user without `clients.view` requests the history of a client
- THEN 403
