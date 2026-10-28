# telephony (Qo'ng'iroqlar)

## Purpose
Phone calls from the PBX (webhook) and the browser softphone (SIP over WebSocket, JsSIP), logged and tied
to leads and clients by number. Ported from uzbridge. Implementation: `apps/crm` (Call, Extension,
TelephonySettings, Connection), page key `telephony`;
changes `add-crm-telephony`, `add-crm-full-parity`.

## Requirements

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

### Requirement: Extensions
Each user MAY have one extension: internal number, SIP login, SIP password, "browser phone" flag.
The SIP password SHALL be write-only in the API; `GET /telephony/me/` returns it only to its owner and only
when the browser phone is on and a WSS address is set.

### Requirement: PBX webhook
`POST /telephony/hook/{token}/` (no login) SHALL accept a JSON object, a JSON list (≤ 50) or a form post from
any PBX and upsert calls by the PBX call id. Field names are read from the common spellings
(callid/uuid/linkedid, src/caller, dst/called, billsec/duration, disposition/status…). Direction and the
client's number are worked out; the PBX's own numbers are never the client. Unknown or disabled token → 404.

#### Scenario: Ringing then hang-up without answer
- WHEN the hook receives `{call_id: "a1", event: "ringing", from: "+998901112233", to: "101"}`
  and then `{call_id: "a1", event: "hangup"}`
- THEN one call exists with direction `in`, status `missed`, operator = user of extension 101

#### Scenario: Late ringing
- WHEN a "ringing" event arrives for a call that has already ended
- THEN the call is not changed

### Requirement: Calls into the CRM
When a non-internal call ends, the rules SHALL run once: link the open lead of the number (by the lead's phone
or its client's phone), else per settings create a lead "Qo'ng'iroq: <phone>" in the first stage; write the
call ("Kiruvchi qo'ng'iroq · +998 90 111 22 33 · 2:31") to the lead's and the client's history; for a missed
call add a call-back task unless one is open; an answered call closes the open call-back tasks of that lead.

#### Scenario: Missed call from an unknown number
- WHEN a missed call from a number no lead or client has ends
- THEN a lead with that phone, a call-back task due in the configured minutes and a history line exist

#### Scenario: Answered call back
- WHEN an answered call with the same number follows
- THEN it is linked to the same lead and the call-back task is done

### Requirement: Call log
`GET /telephony/calls/` SHALL list calls newest first with filters (direction, status, user, date range,
`q` by number or name) and `GET /telephony/calls/stats/` the counts for a period (incoming, outgoing,
answered, missed, talk seconds, missed not called back). `PATCH /telephony/calls/{id}/ {note, lead_id}` saves a
result note or links a lead; `POST /telephony/calls/{id}/lead/` creates a lead from the call.

### Requirement: Live calls and softphone
`GET /telephony/calls/live/` SHALL return the current user's ringing/talking calls and calls ended in the last
two minutes; calls left ringing/talking for 30 minutes are closed. The browser phone (JsSIP) reports its calls to
`POST /telephony/softphone/`; those reports are ignored while a PBX webhook has been received in the last two
days.

#### Scenario: Softphone call without PBX webhook
- WHEN the softphone reports ringing → answer → hangup (billsec 40) for an outgoing call
- THEN a call `out`, `answered`, duration 40, user = the reporter exists

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
