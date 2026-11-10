# ADR 0015 — Window constructor lives in a leaf app `konstruktor`, engine in Python

- Status: proposed
- Date: 2026-11-11
- Relates to: ADR 0004 (Loyiha as hub), ADR 0012 (BOM and MRP app); change `add-window-constructor`

## Context
Sales types hisob-kitob quantities by hand from a drawing. The Romchi team (Conamobile) gave Rombo their
window-calculation logic (Romchi 2.0 v7.2) to reuse. We need drawing → pieces → cutting → calc lines, used by
the browser editor, prints, MRP and later bots / MCP.

## Decision
1. New app `apps/konstruktor` owns `ProfileSystem`, `ProfileSystemItem`, `Construction`,
   `ConstructionResult`. Dependency direction: `projects ← konstruktor ← mrp`; it reads `pricing`, writes
   through `projects` services; `projects` shows it via `register_detail_block`.
2. One calculation engine, pure Python (`apps/konstruktor/engine/`), backend only; the editor uses a preview
   endpoint. Workshop rules are profile-system data, not code.
3. The engine fills the existing hisob-kitob (by price-list item); it never makes a second price.
4. We re-implement from the documented Romchi formulas; their decompiled sources are not committed.

## Rejected
- *Engine in TypeScript (browser only or twice)* — the backend must be the authority; two engines drift.
- *Constructor inside `projects`* — the hub would grow geometry and cutting code and depend on pricing rules.
- *Romchi's free point/area model* — more than Rombo's rectangular range needs; arches added as an attribute.
