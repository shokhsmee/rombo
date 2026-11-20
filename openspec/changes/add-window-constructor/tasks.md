# Tasks: add-window-constructor

Each phase ends usable on its own. Do not start Phase 1 numbers before Phase 0 is signed off.

## Phase 0 — Ground truth (workshop + sales, ~3 days)
- [ ] 0.1 Get the Romchi team's permission in writing (email/letter) and file it; note it in ADR 0015
- [ ] 0.2 With the workshop: for "Rombo Termo 306J 65" confirm widths, weld/mullion allowances, sash overlap,
      glass and bead deductions, rubber rule, hardware set per sash type, bar 6.5 m, kerf, trim
- [x] 0.3 `docs/reference/romchi-formulas.md`: the formulas we reuse (BaseLength/Surface/Count, widths table,
      arc length, cutting) — summary only, no decompiled code in the repo
- [ ] 0.4 Collect 5–10 real orders: drawing + sales hisob-kitob + workshop cut list → `apps/konstruktor/tests/fixtures/*.json`

## Phase 1 — Engine (backend only)
- [x] 1.1 `apps/konstruktor/engine/`: construction schema (pydantic/dataclasses) + validation (sizes, positions, min cell)
- [x] 1.2 Geometry: frame, mullions, sashes → pieces (role, cut length, angle), glass panes, beads, rubber, area
- [x] 1.3 Hardware rules per sash type from the system's table
- [x] 1.4 Cutting: BFD with kerf + trim, pooled by item → bars, plan, offcuts
- [x] 1.5 Unit tests: every scenario in `specs/constructions` (golden fixtures wait for 0.4)

## Phase 2 — Profile systems + constructions API
- [x] 2.1 Models `ProfileSystem`, `ProfileSystemItem`, `Construction` (AuditModel + SoftDeleteModel, `KS-00001`, TRACK)
- [x] 2.2 Seed "Rombo Termo 306J 65" system mapped to the seeded price list items
- [x] 2.3 Services: `system_create/update`, `construction_create/update/duplicate/delete`, preview; selectors
- [x] 2.4 Registry pages `constructions`, `profile_systems`; `CHATTER_PAGES`; roles (Sotuvchi: constructions CRUD)
- [x] 2.5 API tests (permissions, lock with production fields, validation errors on fields)

## Phase 3 — Editor UI
- [x] 3.1 `src/modules/konstruktor/`: api.ts, ProfileSystemsListPage / FormPage
- [x] 3.2 Loyiha tab "Chizmalar": list of constructions (thumbnail, size, count, m²)
- [x] 3.3 Construction editor: templates, numeric w/h/mullion entry, click cell → fill / sash, SVG preview with
      dimensions and opening marks, live panel (pieces, glass m², price) from `preview`
- [ ] 3.4 Mobile layout for measurers (zamerchik) on site — single-column layout works, not tested on a phone

## Phase 4 — Hisob-kitob, cut list, prints
- [x] 4.1 `ProjectCalcLine.source` migration; "Chizmadan to'ldirish" service + button; missing-map warnings
- [x] 4.2 Derived Loyiha items from constructions; items editor read-only
- [x] 4.3 Cut plan endpoint + view (bars as stripes with pieces and offcut)
- [ ] 4.4 Prints: construction sheet (client / contract annex), workshop sheet — the cut-plan page prints for now
- [x] 4.5 Engine output stored on the construction at save; system changes never re-cut it (no separate table)

## Phase 5 — MRP
- [x] 5.1 Materials of a Loyiha with constructions from the engine (stock units via price item → product)
- [x] 5.2 Test: a drawn Loyiha's need in stock units (2 bars × 6.5 m = 13 m); BOM-based Loyihas keep the mrp tests

## Phase 6 — Later (separate changes)
- [ ] Arches (Romchi arc length `R·θ + extra`, arch cut-off area), shotlandka, lambri, sliding 35
- [ ] Offcut stock reused by the cutter
- [ ] 3D preview (Three.js) from the same geometry
- [ ] Telegram Mini App for measurers / dealers; MCP tools `construction_preview`

## Close
- [ ] README section, CHANGELOG line, ADR 0015 accepted
- [ ] Archive: merge deltas into `specs/constructions`, `specs/projects`, `specs/mrp`, `specs/access-control`
