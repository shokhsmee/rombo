# ADR 0014 — Claude reaches the ERP through one MCP endpoint that replays the REST API as the user

- Status: accepted
- Date: 2026-11-10
- Relates to: change `add-claude-mcp`; ADR 0002 (service layer), ADR 0003 (page permissions)

## Context
- Staff want Claude (claude.ai, Desktop, Claude Code) to read ERP data and do routine work for them.
- Admins want Claude to read the OpenSpec specs, compare them with the running system and file fix ideas.
- Permissions live in one place: `PagePermission` on each viewset. A second copy would drift.

## Decision
1. One MCP endpoint, `/api/v1/mcp/`, MCP Streamable HTTP in stateless mode (JSON answers, no SSE), written
   in plain Django — no MCP SDK.
2. Claude acts **only as a user**. Personal tokens (`rmb_…`, SHA-256 stored, scope `read | write`, optional
   expiry, tied to `token_version`) or the same token in a secret URL for claude.ai connectors.
3. ERP tools are generic: `list_resources` / `describe_endpoint` discover, `api_get` / `api_write` run the
   **real DRF view in-process** with the user forced (`request._force_auth_user`). Only viewsets with a
   `page_key` (and chatter) are reachable; `auth/`, `mcp/`, schema, webhooks and Mini App APIs are not.
4. `apps.mcp` is the top of the dependency chain: it reaches business apps only through their URLs, and
   reads `apps.specs` (specs copy, fix ideas) directly.
5. Specs are copied into the database by `manage.py specs_sync` at deploy, because the backend image has no
   `openspec/` folder.

## Rejected
- *A tool per business action* — dozens of tools to keep in step with the API, each a new place to get
  permissions wrong.
- *A local stdio MCP server per user* — every user installs and runs something; no claude.ai / mobile.
- *OAuth 2.1 now* — the right long-term fit for claude.ai connectors, but needs authorize/consent pages and a
  client registry. Can be added in front of the same endpoint later.

## Consequences
- Every new viewset is available to Claude automatically, with the same permissions. A view that must stay
  out of Claude's reach either has no `page_key` or is added to `BLOCKED_PREFIXES` in `apps/mcp/bridge.py`.
- The connector URL holds the token: treat it like a password; revoke it from Tizim → Claude ulanish.
- Run `specs_sync` on every deploy, or Claude reads stale specs.
