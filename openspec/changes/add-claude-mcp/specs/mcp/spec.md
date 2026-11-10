## ADDED Requirements

### Requirement: MCP tokens
A user with `mcp.create` SHALL be able to create personal MCP tokens (name, scope `read | write`, optional
expiry in days). The secret `rmb_…` and the connector URL are returned once; only a prefix is stored readable.
A user sees and revokes only their own tokens. A token stops working when it is revoked, expires, the user is
blocked, or the user's `token_version` changes.

#### Scenario: Secret shown once
- WHEN `POST /mcp/tokens/ {name, scope}` succeeds
- THEN the response has `token` and `connector_url`, and `GET /mcp/tokens/` shows only `prefix`

#### Scenario: Password change kills tokens
- WHEN the owner's password is changed
- THEN calls with an older token return 401

### Requirement: MCP endpoint
`POST /api/v1/mcp/` (and `/api/v1/mcp/t/<token>/`) SHALL speak MCP Streamable HTTP in stateless mode:
JSON-RPC 2.0 `initialize`, `ping`, `tools/list`, `tools/call`; notifications are answered 202; `GET` is 405.
The bearer token comes from `Authorization: Bearer` or the URL. The user also needs `mcp.view`.

#### Scenario: No token
- WHEN a request has no valid token
- THEN 401 with `WWW-Authenticate: Bearer`

#### Scenario: Initialize
- WHEN a client sends `initialize`
- THEN the result has `protocolVersion`, `capabilities.tools`, `serverInfo.name = "rombo-erp"` and instructions

### Requirement: Tools act as the user
ERP tools SHALL run the real API view with the token's user, so page permissions, validation and history are
the same as in the browser. `api_write` exists only for `write` tokens; a `read` token changes no ERP data but
may still file ideas (`idea_create`, needs `fix_ideas.create`). Paths under `auth/`, `mcp/`,
`schema/`, `docs/`, bot webhooks and Mini App APIs SHALL be refused. Tools for pages the user lacks are not
listed and fail if called.

#### Scenario: Permission respected
- WHEN a user without `clients.create` calls `api_write POST clients/`
- THEN the tool result is an error with status 403 and nothing is created

#### Scenario: Read token
- WHEN a `read` token calls `api_write`
- THEN the tool result is an error and `api_write` is absent from `tools/list`

#### Scenario: Discovery
- WHEN a user calls `list_resources`
- THEN only resources whose page the user can view are returned, with their paths and allowed actions
