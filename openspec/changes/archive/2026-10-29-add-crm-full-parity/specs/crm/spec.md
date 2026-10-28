## ADDED Requirements

### Requirement: Custom lead fields
Admins (crm.update) SHALL add fields to the lead card: label, type (text, number, date, select, phone, url, bool),
section (deal, contact, extra), select options. The key is made from the label once; type, section and key never
change. Deal and extra values are stored on the lead; contact values on the client (every lead of that client
shows them). Only active fields' scalar values are accepted.

#### Scenario: Contact value without a client
- WHEN a contact-section value is saved on a lead with no client
- THEN 400

#### Scenario: Contact value shared
- WHEN a contact value is saved through one lead of a client
- THEN another lead of the same client shows it

### Requirement: Tags, lost reasons, task types, card setup
A lead SHALL have tags (trimmed, unique, at most 15). Each pipeline SHALL have its own lost reasons (defaults
seeded). Task types SHALL be an editable list (first = default). The kanban card's fields SHALL be chosen by an admin
for everyone (standard keys and `f:<field>`).

### Requirement: Duplicates and merging
When the duplicates add-on is on, a lead SHALL list other open leads with the same number (its own or its client's)
or the same client; the board marks them "Dubl"; quick add warns while typing a known number. Merging lead A into an
open lead B SHALL move A's tasks, calls, intake records and history to B, union the tags, keep the larger budget,
append notes, fill B's empty client / phone / contact, and close A as lost with reason "Dubl: <B code>".

#### Scenario: Merge
- WHEN lead A is merged into lead B
- THEN B has A's tasks and history, and A is lost with "Dubl: LD-…"

#### Scenario: Into a closed lead
- WHEN the target lead is not open
- THEN 409

### Requirement: Auto-assignment
When distribution is on, a lead created without a manager and asked to (quick add, calls, forms, amoCRM without a
match, Telegram) SHALL get the next employee of the queue: round robin, or the one with the fewest open leads (ties in
queue order). The assigned manager is notified.

#### Scenario: Round robin
- WHEN three auto-assigned leads arrive with a queue of A, B, C
- THEN they go to A, B, C and the fourth to A

### Requirement: Bulk actions
`POST /crm/leads/bulk/ {ids ≤ 500, action}` SHALL move (only leads of that stage's pipeline), assign, tag, untag,
reject (reason required) or delete (crm.delete; leads with a Loyiha stay).

### Requirement: Board filters
The board SHALL offer quick views (mine, today's tasks, overdue, no task, new today, quiet 3 days, missed call,
duplicates, won, lost), a filter panel (status, stage, manager, task, created period, budget, source, tags, every custom
field) and presets saved in the browser. `closed=all` loads won / lost cards older than 30 days; `created_from` /
`created_to` narrow by arrival.

### Requirement: CRM analytics
`GET /crm/analytics/?date_from&date_to&pipeline&manager` SHALL return totals (new, won, lost, open, stale, win rate,
won budget, average deal, median days to win, open / overdue tasks), a daily series, the funnel (reached per work
stage, % of first and of previous, median time in stage, won row), sources, lost reasons and a per-manager table
(response time, calls, talk time).

### Requirement: Lead sources
Connections of kind `webhook` (website / ad forms) and `yuboraman` SHALL receive requests at
`/api/v1/crm/hooks/leads/<token>/` (JSON object or list ≤ 50, or a form; GET answers a link check and echoes
`hub.challenge`). Name / phone / email / text are read from common key spellings (Facebook `field_data` and JSON in a
wrapper field included); other fields go into the history line. A request id already seen is not taken twice; a known
number goes into its open lead (or a new one with `always_new`); a payload with nothing recognisable still makes a lead
"Tekshirish kerak". A REST source can also be pulled.

#### Scenario: Same request twice
- WHEN a form posts `{id: "f-1", name, phone}` twice
- THEN one lead exists and the second answer says `already: true`

### Requirement: amoCRM as a lead source
An `amocrm` connection SHALL connect with a private integration's keys and auth code (code exchanged once, never
stored; tokens encrypted, refreshed under a row lock before expiry; host must be amoCRM / Kommo), subscribe a webhook,
and import deals with their main contact into leads: one lead per deal (kept in step after), stage matched by name,
amoCRM won / lost to the won / lost stage, manager by the amoCRM user's email. Import runs on demand, every 10 minutes
and on the webhook (the deal is always re-read from the API).

#### Scenario: Deal won in amoCRM
- WHEN the amoCRM webhook names a deal now in status 142
- THEN its lead moves to the won stage

### Requirement: Notifications
Assigning a lead to someone else and an open task falling due SHALL push a notification to that person (a toast that
opens the lead); a task reminder goes out once.
