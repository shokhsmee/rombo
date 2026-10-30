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

#### Scenario: One job fails
- WHEN copying a recording raises an error
- THEN the reminders and token refresh of the same run still happen and the error is logged

### Requirement: Django 404 / 403 in the error format
A Django `Http404` / `PermissionDenied` raised in a view SHALL answer 404 / 403 in the API error format (it answered 500).

#### Scenario: Missing drawing
- WHEN downloading a drawing id that does not exist
- THEN 404 with `{"error": {"code": "not_found", ...}}`

### Requirement: Breadcrumb trail across apps
The UI SHALL show the pages the user followed links through as clickable crumbs above the page. Visiting a
page already on the trail SHALL cut the trail back to it; a record pager step or a post-save redirect SHALL
replace the last crumb; a sidebar item, the dashboard, "Yangi loyiha" or a typed URL SHALL start a new
trail. Record crumbs show the record's code; list crumbs keep their filters.

#### Scenario: Back to the order from the payment
- WHEN the user opens XB-00001, then its money request PS-00001, then the RKO that paid it
- THEN the trail reads "XB-00001 › PS-00001 › RKO-00001", and clicking "XB-00001" opens the order with a
  trail of one crumb

#### Scenario: Sidebar starts over
- WHEN the user clicks "Kassa va bank" in the sidebar from deep in a trail
- THEN the trail is only "Kassa va bank"

### Requirement: Excel export
Every list with list tools SHALL offer `GET export/` returning an xlsx of the filtered rows (or of
`ids`), at most 10 000 rows, needing view permission.

#### Scenario: Export follows the filter
- WHEN clients are filtered by region "Toshkent" and exported
- THEN the file has a header row and only those clients

### Requirement: Excel import
Lists with import SHALL accept an xlsx whose first row holds the template headers. Each row is validated
by the list serializer and created by the list's create service in its own savepoint; `dry_run` saves
nothing. The response lists `rows` (`row`, `ok`, `errors`, `label`) and `created`. Needs create
permission. At most 2 000 rows.

#### Scenario: Bad rows do not block good ones
- WHEN an import has 3 rows and the second lacks the required name
- THEN rows 1 and 3 are created and row 2 is reported with its error

#### Scenario: Dry run
- WHEN the same file is sent with `dry_run=true`
- THEN the same report comes back and nothing is created

### Requirement: Batch operations
`POST bulk/ {ids, action, params}` SHALL run the named action for each id through the same service and
permission as the single-record action, each in its own savepoint, and return `done` and `failed`
(`id`, `label`, `message`). At most 500 ids. Unknown action → 400; missing permission → 403.

#### Scenario: Partial success
- WHEN three draft moves are posted in one batch and one lacks stock
- THEN two are posted and one is reported as failed with "Omborda yetarli emas"
