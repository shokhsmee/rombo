# Tasks: add-window-constructor

Each phase ends usable on its own. Do not start Phase 1 numbers before Phase 0 is signed off.

## Phase 0 — Ground truth (workshop + sales, ~3 days)
- [ ] 0.1 Get the Romchi team's permission in writing (email/letter) and file it; note it in ADR 0015
- [ ] 0.2 With the workshop: for "Rombo Termo 306J 65" confirm widths, weld/mullion allowances, sash overlap,
      glass and bead deductions, rubber rule, hardware set per sash type, bar 6.5 m, kerf, trim
- [ ] 0.3 `docs/reference/romchi-formulas.md`: the formulas we reuse (BaseLength/Surface/Count, widths table,
      arc length, cutting) — summary only, no decompiled code in the repo
- [ ] 0.4 Collect 5–10 real orders: drawing + sales hisob-kitob + workshop cut list → `apps/konstruktor/tests/fixtures/*.json`

## Phase 1 — Engine (backend only)
- [ ] 1.1 `apps/konstruktor/engine/`: construction schema (pydantic/dataclasses) + validation (sizes, positions, min cell)
- [ ] 1.2 Geometry: frame, mullions, sashes → pieces (role, cut length, angle), glass panes, beads, rubber, area
- [ ] 1.3 Hardware rules per sash type from the system's table
- [ ] 1.4 Cutting: BFD with kerf + trim, pooled by item → bars, plan, offcuts
- [ ] 1.5 Unit tests: every scenario in `specs/constructions`, plus golden fixtures (match workshop ± 1 mm, same bar count)

## Phase 2 — Profile systems + constructions API
- [ ] 2.1 Models `ProfileSystem`, `ProfileSystemItem`, `Construction` (AuditModel + SoftDeleteModel, `KS-00001`, TRACK)
- [ ] 2.2 Seed "Rombo Termo 306J 65" system mapped to the seeded price list items
- [ ] 2.3 Services: `system_create/update`, `construction_create/update/duplicate/delete`, preview; selectors
- [ ] 2.4 Registry pages `constructions`, `profile_systems`; `CHATTER_PAGES`; roles (Sotuvchi: constructions CRUD)
- [ ] 2.5 API tests (permissions, lock with production fields, validation errors on fields)

## Phase 3 — Editor UI
- [ ] 3.1 `src/modules/konstruktor/`: api.ts, ProfileSystemsListPage / FormPage
- [ ] 3.2 Loyiha tab "Chizmalar": list of constructions (thumbnail, size, count, m²)
- [ ] 3.3 Construction editor: templates, numeric w/h/mullion entry, click cell → fill / sash, SVG preview with
      dimensions and opening marks, live panel (pieces, glass m², price) from `preview`
- [ ] 3.4 Mobile layout for measurers (zamerchik) on site

## Phase 4 — Hisob-kitob, cut list, prints
- [ ] 4.1 `ProjectCalcLine.source` migration; "Chizmadan to'ldirish" service + button; missing-map warnings
- [ ] 4.2 Derived Loyiha items from constructions; items editor read-only
- [ ] 4.3 Cut plan endpoint + view (bars as stripes with pieces and offcut)
- [ ] 4.4 Prints: construction sheet (client / contract annex), workshop sheet (pieces, cut list, glass order)
- [ ] 4.5 Freeze `ConstructionResult` on confirm

## Phase 5 — MRP
- [ ] 5.1 Materials of a Loyiha with constructions from the engine (stock units via price item → product)
- [ ] 5.2 Tests: MRP plan with one constructed and one BOM-based Loyiha

## Phase 6 — Later (separate changes)
- [ ] Arches (Romchi arc length `R·θ + extra`, arch cut-off area), shotlandka, lambri, sliding 35
- [ ] Offcut stock reused by the cutter
- [ ] 3D preview (Three.js) from the same geometry
- [ ] Telegram Mini App for measurers / dealers; MCP tools `construction_preview`

## Close
- [ ] README section, CHANGELOG line, ADR 0015 accepted
- [ ] Archive: merge deltas into `specs/constructions`, `specs/projects`, `specs/mrp`, `specs/access-control`
