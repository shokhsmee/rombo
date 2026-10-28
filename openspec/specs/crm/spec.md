# crm (Lidlar / voronka)

## Purpose
Pre-sale work before a Loyiha exists: leads in a pipeline of stages, their tasks, and conversion into a
Mijoz + Loyiha. Ported from uzbridge. Implementation: `apps/crm` (Pipeline, Stage, Lead, LeadTask), page key
`crm`; change `add-crm-telephony`.

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
