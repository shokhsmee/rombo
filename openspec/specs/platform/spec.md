# platform

## Purpose
Cross-cutting runtime pieces: secrets at rest, live updates to the browser, the background worker, the API error
format for Django's own exceptions. Implementation: `apps/core` (crypto, realtime, consumers), `config/asgi.py`,
`apps/crm/services/worker.py`; change `add-crm-full-parity`.

## Requirements

### Requirement: Secrets at rest
Secrets kept in the database (SIP passwords, provider keys and tokens, amoCRM and Google tokens, Telegram sessions)
SHALL be Fernet-encrypted with env FIELD_ENCRYPTION_KEY (comma list: the first encrypts, all decrypt). Without a key
DEBUG derives one from SECRET_KEY; production refuses. The API never returns a secret: only "saved" with a masked tail.

#### Scenario: Existing SIP passwords
- WHEN the migration runs on a database with plain SIP passwords
- THEN they are stored as Fernet tokens and still read back as the same password

### Requirement: Live updates
`/ws/live/?token=<JWT access>` SHALL accept only a valid, unrevoked access token from an allowed origin, push to everyone
or to named users, and ping every 25 s. `runserver` serves it (daphne); REDIS_URL shares pushes between processes.

#### Scenario: Someone else's call
- WHEN a call event is pushed to user B
- THEN user A's socket does not receive it

### Requirement: Background worker
`manage.py crm_worker` SHALL, every minute, close stale live calls, copy due recordings, send task reminders, refresh
amoCRM tokens expiring within 6 hours, and every 10 minutes pull history of enabled connections; one failing job does
not stop the others.

### Requirement: Django 404 / 403 in the error format
A Django `Http404` / `PermissionDenied` raised in a view SHALL answer 404 / 403 in the API error format (it answered 500).
