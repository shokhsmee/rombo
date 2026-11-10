## ADDED Requirements

### Requirement: Spec sync
`manage.py specs_sync` SHALL copy `OPENSPEC_DIR` into `SpecDocument` rows: `project.md` (kind `project`),
`specs/<cap>/spec.md` (kind `spec`), every file of active changes (kind `change`) and archived changes
(kind `archived`). Unchanged files (same SHA-256) are not rewritten; rows whose file is gone are deleted.
A missing directory is an error and changes nothing.

#### Scenario: Re-run
- WHEN `specs_sync` runs twice with no file changes
- THEN the second run reports 0 created, 0 updated, 0 deleted

### Requirement: Spec browser
`GET /specs/documents/` SHALL list documents (without content) filtered by `kind`, `ref` and `q` (full-text in
path and content); `GET /specs/documents/{id}/` returns the content. Page `specs`, view only.

#### Scenario: Without the page
- WHEN a user without `specs.view` lists documents
- THEN 403

### Requirement: Fix ideas
A fix idea SHALL have code `TK-0001`, title, kind `fix | improvement | feature`, capability, priority
`low | normal | high`, problem, proposal, impact, source `mcp | manual`, status `new → accepted → done`,
`new | accepted → rejected` (a reason is required), `rejected → new` (reopen). A done idea is read-only; only a
new idea can be deleted. Changes go to chatter. `GET /specs/ideas/{id}/proposal/` returns markdown with
Why / What changes / Impact for an OpenSpec proposal.

#### Scenario: Wrong move
- WHEN an idea in `done` is moved to `new`
- THEN 409

#### Scenario: Proposal draft
- WHEN `GET /specs/ideas/{id}/proposal/`
- THEN the markdown starts with `# Change:` and contains `## Why`, `## What changes`, `## Impact`

### Requirement: OpenSpec stays consistent
The test suite SHALL fail when an archived change's ADDED or MODIFIED requirement is missing from
`openspec/specs/<cap>/spec.md`, a REMOVED one is still there, or a requirement has no scenario.

#### Scenario: Unmerged delta
- WHEN a change is archived without merging its delta
- THEN the consistency test names the change and the requirement
