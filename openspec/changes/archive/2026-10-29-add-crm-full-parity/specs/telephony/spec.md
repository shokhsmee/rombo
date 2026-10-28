## MODIFIED Requirements

### Requirement: Telephony settings
One settings row SHALL hold the rules: per direction what an unknown number does (create a lead, only a client,
nothing), the policy for a known client (write to the open lead, always a new lead, only link), the new lead's
pipeline / stage / responsible (operator, the client's manager, a fixed employee) / title template `{phone}` / source /
tags, the call-back task and its delay, the popup, and the minimum talk time for the history. Provider addresses, keys
and the webhook token live on connections (crm `Connection`, kinds `utel`, `moizvonki`, `pbx`); the former single
webhook token became a `pbx` connection with the same token.

#### Scenario: Rotate token
- WHEN `POST /crm/connections/{id}/token/`
- THEN a new token is issued and the old webhook URL returns 404

## ADDED Requirements

### Requirement: Provider telephony
UTeL and Moi Zvonki webhooks SHALL be read in their own envelopes (UTeL `data.name` events, `call_saved` history;
Moi Zvonki `webhook.action` + `event`). UTeL's own line (`external_number`) is learnt into the connection's company
numbers. History SHALL be pulled from UTeL (`/call-history`, token from email + password, cached encrypted),
Moi Zvonki (`calls.list`) or a generic REST path, every 10 minutes and on demand; history calls only link to existing
leads, never create leads or tasks. Moi Zvonki SHALL subscribe its webhook when saved and re-subscribe on check.

#### Scenario: History links only
- WHEN a UTeL history call from an unknown number is pulled
- THEN the call is stored with source `sync` and no lead is made

### Requirement: Click-to-call
`POST /telephony/dial/ {number}` SHALL ring the employee's own mobile through Moi Zvonki (with their own API key, else
the admin key) or the extension through an IP-PBX originate path; otherwise it answers that click-to-call is not set up
(the browser phone or the device dialer is used).

### Requirement: Recordings in Google Drive
With a Google account connected (OAuth, `drive.file`; app from env GOOGLE_CLIENT_ID / SECRET) and recordings switched
on, every ended call with a recording started after the switch SHALL be copied by the worker into one Drive folder.
Not ready yet → retried after 2, 10, 30 minutes, then the reason is kept on the call. Playback uses a signed 12-hour
Rombo link that streams the Drive file (Range passes through).

#### Scenario: Recording not ready
- WHEN the PBX answers 404 for a recording
- THEN the call is retried later and no error is stored yet

### Requirement: Call analytics
`GET /telephony/calls/analytics/` SHALL return totals (answer rate, outbound connect rate, average talk and wait, missed
returned / still open, median call-back time), a daily series, a weekday × hour heatmap of all and missed calls, per
employee and per connection tables, and how fast new leads got their first call.

### Requirement: Live popup over the socket
Calls SHALL be pushed to their operator over `/ws/live/`; `/telephony/calls/live/` is polled only while the socket is
down.

### Requirement: No AI call analysis
uzbridge's AI transcription and review of calls SHALL NOT be part of Rombo (product owner's decision).
