# platform — delta

## ADDED Requirements

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
