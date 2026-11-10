# Change: add-claude-mcp

## Why
Staff want to ask Claude about their work ("which service requests are overdue?", "make a purchase request for
Loyiha MJ-00012") and have it act in the ERP for them, with exactly their own permissions. Admins and the owner
also want Claude to read how the system is *supposed* to work (the OpenSpec specs), compare it with what the
system does, and write down fix and improvement ideas that the team can triage.

Today the specs live only in the git repository, the server has no copy the app can read, and nothing checks
that the archived changes were really merged into `openspec/specs/`. Some requirements have no scenario, which
`openspec validate` rejects.

## What changes
- **MCP server inside the ERP** (`POST /api/v1/mcp/`, MCP Streamable HTTP, stateless JSON responses):
  - Personal **MCP tokens** (`rmb_…`): a user creates one on the page *Claude (MCP)*, sees it once, can revoke it.
    Scope `read` (only GET) or `write`. Optional expiry. Blocking the user or changing their password kills it.
  - Two ways to connect: header `Authorization: Bearer rmb_…` (Claude Code, Claude Desktop, API) or a secret
    connector URL `/api/v1/mcp/t/<token>/` for claude.ai custom connectors, which take no headers.
  - Tools run **as the user**: every ERP call goes through the normal DRF view and `PagePermission`, so Claude
    can never do more than the user can in the browser. Tools the user has no page for are not listed.
  - ERP tools: `whoami`, `list_resources`, `describe_endpoint`, `api_get`, `api_write` (write tokens only).
  - Spec tools: `project_context`, `specs_list`, `spec_read`, `specs_search`, `changes_list`, `change_read`.
  - Idea tools: `ideas_list`, `idea_get`, `idea_create`.
- **Specs in the app** (new app `specs`):
  - `manage.py specs_sync` copies `openspec/` (project.md, specs, active and archived changes) into the
    database; unchanged files are skipped by hash, deleted files are removed. Deploy runs it after `migrate`.
  - Page *Spetsifikatsiyalar* (read-only browser) and API `GET /api/v1/specs/documents/`.
  - **Takliflar** (fix ideas) `TK-0001`: title, kind (fix / improvement / feature), capability, priority,
    problem, proposal, status `new → accepted → done`, `rejected`; chatter. Created from Claude or by hand.
    `GET /specs/ideas/{id}/proposal/` renders an accepted idea as an OpenSpec `proposal.md` draft.
- **Access**: pages `mcp` (Claude (MCP) ulanish), `specs` (view only) and `fix_ideas`; system role
  **"MCP tahlilchi"** (MCP + specs + ideas); Administrator gets all three.
- **OpenSpec sync**: every requirement in `openspec/specs/` gets at least one scenario; the finished
  `add-service-maintenance` change is archived and merged; a test fails when an archived delta is not merged,
  or when a requirement has no scenario.

## Impact
- Apps: new `apps/specs` (SpecDocument, FixIdea, sync, API, tests), new `apps/mcp` (McpToken, auth, JSON-RPC
  endpoint, tools, tests). `mcp` sits on top: it calls other apps only through their URLs (the same path a
  browser takes), never imports their services.
- Tables: `specs_specdocument`, `specs_fixidea`, `mcp_mcptoken`; data migration adds the pages to
  Administrator and creates "MCP tahlilchi".
- Endpoints: `/api/v1/mcp/`, `/api/v1/mcp/t/<token>/`, `/api/v1/mcp/tokens/`, `/api/v1/specs/documents/`,
  `/api/v1/specs/ideas/`.
- Frontend: `src/modules/mcp/McpPage.tsx`, `src/modules/specs/` (SpecsPage, IdeasListPage, IdeaFormPage),
  menu group "Tizim".
- Settings: `OPENSPEC_DIR` (default `<repo>/openspec`), `PUBLIC_BASE_URL` for the connect instructions.
- Deploy: `python manage.py specs_sync` after `migrate`; compose mounts `./openspec` read-only into `migrate`.
- ADR 0014 — Claude access through an MCP endpoint that replays the REST API as the user.
