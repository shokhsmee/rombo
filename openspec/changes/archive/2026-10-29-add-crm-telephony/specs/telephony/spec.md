## ADDED Requirements

### Requirement: Telephony settings
One settings row SHALL hold: enabled, SIP WebSocket address (`wss://…`), SIP domain, the PBX's own numbers, a
random webhook token, and the rules: create a lead for an unknown incoming call, for an unknown missed call,
make a call-back task for a missed call and its delay in minutes. Reading needs `telephony.view`, changing
`telephony.update`. No credential is stored in code or git. Page key `telephony`, group "CRM".

#### Scenario: Rotate token
- WHEN `POST /telephony/settings/rotate-token/`
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
