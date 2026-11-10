# Change: add-window-constructor  (status: proposed)

Decisions: `design.md`. Architecture: ADR 0015 (proposed). Phases and checklist: `tasks.md`.

## Why
Sales fills the hisob-kitob by hand: they look at the drawing, guess how many L/Z/T bars, how many m² of
glass and metres of rubber, and type 15–40 quantities per Loyiha. Mistakes go straight into the price, the
purchase request and the workshop. The drawing itself is a photo or PDF in `ProjectFile`, so nothing in the
ERP knows what is being built.

The Romchi team (Conamobile) gave us their calculation logic to reuse (`romchi-decompile`, Romchi 2.0 v7.2:
`REPORT.md`, the series width tables, the cutting optimiser). It shows the proven chain
**drawing (mm) → pieces → bars after cutting → price lines**. We build that chain inside Rombo, on our own
price lists and our own workshop rules, so a drawing fills the hisob-kitob, the material list and the cut list.

## What changes
- **Konstruksiyalar** (new app `apps/konstruktor`, page `constructions`): a Loyiha gets constructions
  (`KS-00001`): a window/door/balcony block drawn in the browser — outer size in mm, split into cells by
  mullions (impost), each cell glass / panel / lambri / sash (turn, tilt-turn, tilt, door, fixed), count ≥ 1.
  Templates: 1-, 2-, 3-cell window, balcony block, door.
- **Profil tizimlari** (page `profile_systems`, Sozlamalar): per series (e.g. "Rombo Termo 306J 65"): its
  price list, bar length, kerf, profile widths (frame / sash / mullion), weld and cut allowances, glass and
  bead deductions, and a **role → price-list item** map (frame → "L -ka", sash → "Z-ka", mullion → "T-ka",
  glass → "Стекло пакет…", rubber, hardware sets…). Rules are data, not code; seeded from the Romchi table
  for the series Rombo uses, then confirmed by the workshop.
- **Engine** (`apps/konstruktor/engine/`, pure Python, no Django): construction → pieces with cut lengths
  (mm), glass panes (w×h mm, m²), beads, rubber (m), hardware (pcs), area. Deterministic, fully unit-tested
  against real Rombo orders (golden fixtures).
- **Cutting** (raskroy): best-fit decreasing with kerf over all constructions of a Loyiha, per profile role →
  number of bars, cut plan per bar, offcuts. Printable cut list for the workshop.
- **Hisob-kitob from constructions**: "Chizmadan to'ldirish" writes the quantities into the Loyiha's
  calculation lines through the role map (bars for profiles, m² for glass, m for rubber, pcs for hardware);
  lines show the source (chizma / qo'lda). Manual lines stay. Prices, rounding, amount, print and contract
  are unchanged.
- **Order lines from constructions**: when a Loyiha has constructions, its items (type · m² · count) are
  derived from them and become read-only.
- **MRP from constructions**: a Loyiha with constructions gets its material need from the engine (exact) instead
  of the BOM-per-m² estimate.
- **Prints**: construction sheet (drawing with sizes, opening arrows) for the client and the contract annex;
  workshop sheet (pieces, cut list per bar, glass order).
- Later phases (not in the first release): arches, shotlandka, sliding systems, offcut stock, 3D preview,
  Telegram Mini App for measurers/dealers, MCP tools.

## Out of scope
- Romchi's prices, API (`romchi.uz`), subscriptions or their markup/benefit model — Rombo price lists are
  already sales prices.
- Copying Romchi source files into the repo. We re-implement from the documented formulas.

## Impact
- Apps: new `apps/konstruktor` (between `projects` and `mrp`); `projects` (items derived, calc line source);
  `mrp` (materials from constructions); `access` (registry); `chatter` (`CHATTER_PAGES`).
- Tables: `ProfileSystem`, `ProfileSystemItem` (role → price-list item), `Construction`, `ConstructionResult`
  (frozen engine output), `CutPlan`; `ProjectCalcLine.source`.
- Endpoints: `/konstruktor/systems/`, `/konstruktor/constructions/` (+ `preview`, `duplicate`),
  `/konstruktor/projects/{id}/cut-plan/`, `/projects/{id}/calcs/{calc_id}/fill-from-constructions/`,
  prints `/print/constructions/{id}`, `/print/projects/{id}/workshop`.
- Pages: Loyiha card tab "Chizmalar" (constructions), construction editor, Profil tizimlari list/form,
  cut-list view.
- Data: no change to existing calcs; old Loyihas without constructions work exactly as now.
