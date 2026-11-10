## ADDED Requirements

### Requirement: Masters
The system SHALL keep masters (Usta) with name, phone (normalised, unique), region, skills, optional Employee and an
active flag; code `US-0001`. A master with open jobs (assigned / accepted / in progress) SHALL NOT be made inactive.
Page key `service_masters`, group "Servis".

#### Scenario: Duplicate phone
- WHEN a master is saved with a phone another master already has, in any format
- THEN the answer is 409 on `phone`

### Requirement: Service requests and their flow
A service request SHALL belong to a client, optionally to one of that client's Loyiha (then warranty by default and
the object address), have a kind, description, phone, address, optional point, preferred date, price, photos, and
code `SV-YY-NNNNN`. Status moves SHALL follow `TRANSITIONS`:
`new → assigned → accepted → in_progress → done → closed`, `cancelled` from new / assigned / accepted /
in_progress (with a reason), `assigned|accepted → new` (declined or taken off), `done → in_progress` (client says
not fixed). Assigning SHALL need an active master. Every move writes one chatter line. Page key `service_requests`.

#### Scenario: Skipping steps
- WHEN the office moves a new request straight to "done"
- THEN the answer is 400 on `status`

#### Scenario: Project of another client
- WHEN a request names a Loyiha of a different client
- THEN the answer is 400

### Requirement: Client bot
The client bot SHALL ask for the user's own phone (contact button); the contact SHALL be the sender's. It SHALL link
the Telegram user to the client with that number or create one ("Telegram servis bot"). The client SHALL get a
message when the request is accepted, a master is assigned (name, phone, time), work starts, is done (with 1–5
rating buttons) or is cancelled.

#### Scenario: Someone else's contact
- WHEN the shared contact belongs to another Telegram user
- THEN nothing is linked and the bot asks again

### Requirement: Master bot
The master bot SHALL link a Telegram user only to an active master with the same phone; unknown numbers are refused
and nothing is created. A master SHALL get each new job with accept / decline buttons, and a message when a job is
taken away, reopened by the client or rated.

#### Scenario: Unknown number
- WHEN a phone that no active master has is shared
- THEN the bot says the number is not on the list and links nothing

#### Scenario: Button of someone else's job
- WHEN a master presses accept on a job assigned to another master
- THEN the job does not change

### Requirement: Mini Apps
`/app/client/` and `/app/master/` SHALL authenticate by Telegram `initData` signed with that bot's token, no older
than 24 h; a client SHALL see and act only on its own requests (create with photos and location, cancel while not
started, rate a done job, reopen it with a comment); a master only on jobs assigned to it (accept, decline, start,
finish with a report and photos). Photos SHALL be served only through signed links.

#### Scenario: Forged initData
- WHEN `initData` is changed after signing or signed by the other bot
- THEN the answer is 401/403

#### Scenario: Another client's request
- WHEN a client opens a request id of a different client
- THEN the answer is 404

### Requirement: Bot transport
Bot updates SHALL be handled the same way by webhook (`/api/v1/maintenance/bot/<kind>/webhook/`, checked with
`X-Telegram-Bot-Api-Secret-Token`) and by `manage.py service_bots` (long polling). Notifications SHALL be sent after
the transaction commits and never fail the business write.

#### Scenario: Webhook without the secret
- WHEN an update is posted without the secret header
- THEN it is refused with 403 and nothing changes
