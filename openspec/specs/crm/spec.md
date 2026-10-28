# crm (Lidlar / voronka)

## Purpose
Pre-sale work before a Loyiha exists: leads in a pipeline of stages, their tasks, and conversion into a
Mijoz + Loyiha. Ported from uzbridge. Implementation: `apps/crm` (Pipeline, Stage, Lead, LeadTask), page key
`crm`; changes `add-crm-telephony`, `add-crm-full-parity`.

## Requirements

### Requirement: Pipelines and stages
The system SHALL keep pipelines (voronka) of ordered stages. A stage is open, won (`is_won`) or lost
(`is_lost`) and has a tone for its colour. When no pipeline exists, a default one SHALL be created with stages
Yangi, Bog'lanildi, O'lchov, Taklif, Shartnoma, Yutildi (won), Rad etildi (lost). Page key `crm`, group "CRM".

#### Scenario: First visit
- WHEN the board is opened and no pipeline exists
- THEN the default pipeline with its seven stages is created and returned

#### Scenario: Stage with leads
- WHEN deleting a stage that still has leads
- THEN 409

#### Scenario: Last terminal stage
- WHEN deleting the only won or the only lost stage of a pipeline
- THEN 409

### Requirement: Leads
A lead SHALL have a code `LD-00001`, title, contact name, phone, optional client, manager (employee), source
(sales channel list), budget, region, address, notes, pipeline, stage, status (`open|won|lost`) and lost reason.
A new lead without a stage goes to the pipeline's first open stage. If a phone is given and an existing client
has the same number (last 9 digits), the lead is linked to that client. Leads are soft-deleted; a lead with a
Loyiha cannot be deleted. Tracked fields are written to chatter (`crm.lead`).

#### Scenario: Create
- WHEN `POST /crm/leads/ {title, phone}` is sent
- THEN the lead is in the first open stage with status `open`, a code `LD-…`, and its history says "Lid yaratildi"

#### Scenario: Search
- WHEN `GET /crm/leads/?q=<words>` is called
- THEN every word must match the code, title, contact name, phone or the client's name

### Requirement: Board
`GET /crm/leads/board/?pipeline=` SHALL return the pipeline, its stages and each stage's lead cards
(client/contact, phone, budget, manager, next open task and whether it is overdue). Won and lost leads not
changed for 30 days are left off the board.

### Requirement: Move between stages
`POST /crm/leads/{id}/move/ {stage_id, lost_reason}` SHALL move a lead to a stage of its own pipeline, set the
status from the stage and write one history line with the old and new stage. Moving to a lost stage requires a
reason.

#### Scenario: Lost without reason
- WHEN a lead is moved to the lost stage without `lost_reason`
- THEN 400 with field `lost_reason`

#### Scenario: Other pipeline
- WHEN `stage_id` belongs to another pipeline
- THEN 400 with field `stage_id`

### Requirement: Tasks
A lead SHALL have tasks: type (`call|meeting|measure|message|other`), text, due time, assignee (user), done.
Creating or completing a task writes a history line on the lead. Open tasks past their due time are overdue.

#### Scenario: Complete a task
- WHEN `PATCH /crm/tasks/{id}/ {done: true}`
- THEN `done_at` is set and the lead's history says the task was done

### Requirement: Convert a lead into a Loyiha
`POST /crm/leads/{id}/convert/ {client_id?, project_name?}` SHALL, in one transaction, take the given client,
else the lead's client, else a client matched by phone, else create a client through the clients service;
create a Loyiha through the projects service (name, client, manager, phone, region, address, sales channel,
amount = budget); move the lead to the won stage and link the client and the Loyiha to it.

#### Scenario: Convert
- WHEN an open lead with contact "Aziz" and phone `+998 90 111 22 33` is converted
- THEN a client "Aziz" and a draft Loyiha exist, the lead is `won` with `project` set,
  and the Loyiha's history mentions the lead's code

#### Scenario: Converted twice
- WHEN a lead that already has a Loyiha is converted again
- THEN 409

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
