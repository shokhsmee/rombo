# Design: add-claude-mcp

## 1. How Claude acts in the ERP
**Chosen: one generic MCP endpoint that replays REST calls as the user.** `api_get` / `api_write` take a path
under `/api/v1/` and run the real DRF view in-process with the token's user forced as `request.user`
(`request._force_auth_user`, the same hook DRF's own test client uses). Permissions, validation, services,
chatter and live updates behave exactly as when the user clicks in the browser.

Discovery comes from the URL resolver: `list_resources` walks `api/v1/`, keeps the viewsets that declare a
`page_key`, and reports their list/detail paths, custom actions and what *this* user may do on each page.
`describe_endpoint` returns that operation's OpenAPI fragment (drf-spectacular, generated once per process).

Rejected:
- *One hand-written tool per business action* (`service_request_assign`, …) — dozens of tools to maintain,
  always behind the API, and each one is a second place where permissions could be got wrong.
- *A separate MCP process (stdio) calling the HTTP API* — every user would have to install and run it; the
  remote endpoint works from claude.ai, Desktop, mobile and Claude Code with no install.
- *The official `mcp` Python SDK* — it brings Starlette/anyio and its own ASGI app next to Django. The
  stateless Streamable HTTP subset we need (initialize, ping, tools/list, tools/call, JSON responses, no SSE) is
  ~150 lines of plain Django.

Blocked paths: `auth/`, `mcp/`, `schema/`, `docs/`, the Telegram/bot webhooks and Mini App APIs (they have
their own authentication) — Claude cannot mint tokens, change passwords or impersonate a bot.

## 2. Authentication
**Personal tokens**, `rmb_` + 43 url-safe chars, stored as SHA-256; only a short prefix is kept readable.
A token carries the user's `token_version` at issue time: blocking the user or changing the password
invalidates it, like JWTs. Scope `read` refuses `api_write` and hides it from `tools/list`.

claude.ai custom connectors cannot send headers, so the token may also sit in the URL
(`/api/v1/mcp/t/<token>/`). That URL is a secret: it is shown once, can be revoked, and the UI says so. It can
land in reverse-proxy access logs; operators who mind set a short expiry or use the header form.

Rejected for now: *OAuth 2.1 with dynamic client registration* — the proper way for claude.ai connectors,
but it needs authorize/consent pages, client registry and refresh tokens. Tokens ship now; OAuth can be added
later behind the same endpoint without changing tools.

## 3. Specs on the server
`git archive` deploys and the Docker image (`build: ./backend`) do not agree on where `openspec/` is, and the
backend image does not contain it at all. **Chosen: copy the files into the database** with
`manage.py specs_sync` (deploy step, idempotent, hash-skips unchanged files). The API and MCP read only the DB, so
they work the same in every setup, and a broken checkout never breaks the app.

Rejected: *reading the files at request time* — the image has no `openspec/`, and the path differs per host.

## 4. Fix ideas
Ideas are ERP records (`FixIdea`, `TK-0001`) and not files, so non-developers can file them from Claude and
admins triage them in the UI with chatter. An accepted idea exports as an OpenSpec `proposal.md` draft; a
developer still creates the change folder — the repo stays the source of truth.

## 5. Keeping OpenSpec in sync
`apps/specs/tests.py` parses `openspec/` and fails when (a) an archived change's ADDED/MODIFIED requirement is
missing from `openspec/specs/<cap>/spec.md`, (b) a REMOVED one is still there, (c) a requirement has no
`#### Scenario:`. This is what `openspec validate` would catch, without needing Node in CI.
