# platform — delta

## MODIFIED Requirements

### Requirement: Background worker
The scheduled jobs SHALL run as Celery tasks on the beat schedule:
- every minute: close stale live calls, copy due recordings, send task reminders, pull history of due
  connections;
- every 5 minutes: refresh amoCRM tokens expiring within 6 hours;
- daily at 09:10 and 18:10 Tashkent: fetch the Central Bank USD rate.

Each job is its own task, and one failing job does not stop the others. Without `REDIS_URL`,
`manage.py crm_worker` runs the same tasks in process every minute.

#### Scenario: One job fails
- WHEN copying a recording raises an error
- THEN the reminders and token refresh of the same minute still run and the error is logged

#### Scenario: Manual rate kept
- WHEN the accountant entered today's USD rate by hand and the 09:10 job runs
- THEN the manual rate stays

## ADDED Requirements

### Requirement: Container stack
`docker compose up -d --build` SHALL start the whole system: PostgreSQL, Redis, migrations (once, before the
rest), the API, the Celery worker with beat, the Telegram listener, and nginx serving the SPA and proxying
`/api`, `/ws`, `/admin`.

#### Scenario: Fresh start
- WHEN the stack starts on an empty volume
- THEN migrations run once, then the API, worker and listener start, and the login page answers on `HTTP_PORT`
