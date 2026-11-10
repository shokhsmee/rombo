## ADDED Requirements

### Requirement: Claude and specs pages
The registry SHALL have, in group "Tizim": `mcp` "Claude (MCP) ulanish" (view, create, delete), `specs`
"Spetsifikatsiyalar" (view only) and `fix_ideas` "Takliflar" (all actions). System role "MCP tahlilchi" SHALL
have `dashboard.view`, `mcp` view/create/delete, `specs.view` and `fix_ideas` view/create/update. The
existing Administrator role gets full access to all three.

#### Scenario: Upgrade
- WHEN the migration runs on a database that has role "Administrator"
- THEN Administrator can view `specs` and create `mcp` tokens, and role "MCP tahlilchi" exists
