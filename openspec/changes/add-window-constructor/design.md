# Design: add-window-constructor

Source of the formulas: Romchi 2.0 v7.2 logic handed over by the Romchi team (`REPORT.md` and
`docs/spec/` of `romchi-decompile`). We keep a short summary of what we reuse in
`docs/reference/romchi-formulas.md` (task 0.3) and never commit their decompiled sources.

## D1. Where the engine runs
**Chosen: one engine, in Python on the backend (`apps/konstruktor/engine/`), pure functions, no Django.**
The editor draws the 2D picture itself (layout only) and calls `POST /konstruktor/constructions/preview/`
(debounced ~300 ms) for pieces, glass, area and price. Saving runs the same engine and stores its output.

Rejected:
- *TypeScript engine in the browser only* — the backend must stay the authority (AGENTS §3); MCP, bots,
  MRP and prints need the numbers without a browser.
- *Two engines (TS for live, Python for save)* — they drift; every rule change would have to be made twice and
  a sales offer could differ from the workshop list.

## D2. Construction model: a split tree, not free points
A construction is a JSON document (`schema: 1`), validated on save:

```
{ "w": 1200, "h": 1400,
  "root": { "split": "v", "at": [600],          // mullion positions from the left, mm
            "cells": [ { "fill": "glass", "glass": "pakt_pepel" },
                       { "sash": { "type": "tilt_turn", "hinge": "left" }, "fill": "glass" } ] } }
```

A cell is either a leaf (fill + optional sash) or a split (`v` / `h`, positions, child cells); a sash cell
may be split again (sash with its own mullion). This always produces a valid frame; Romchi's free point/area
model needs snapping and repair logic we don't need for rectangular work.

Rejected: *Romchi's points + areas model* — more freedom (diagonal shapes) than Rombo sells, much more
validation. Arches come later as a frame attribute (`arch: {rise}`), not as free geometry.

## D3. Rules are data per profile system
Everything the workshop may change is a field of `ProfileSystem`, not a constant in code:

| Field | Meaning | Romchi source |
|---|---|---|
| `bar_length_mm`, `kerf_mm` (5), `trim_mm` | stock bar, saw cut, end trim | `kerfThickness`, `maxTrimWaste` |
| `frame_width`, `sash_width`, `mullion_width` | visible profile widths (mm) | `calculationProfileDetails` (parent/inner) |
| `weld_allowance_mm` | added per welded end | — (workshop) |
| `mullion_allowance_mm` | mullion cut vs. clear span | `stickToOP` ± innerWidth |
| `sash_overlap_mm` | sash outer size vs. opening | — |
| `glass_deduction_fixed_mm`, `glass_deduction_sash_mm` | glass size vs. light opening | `extra` in `calculateChizma` |
| `bead_*`, `rubber_*` | bead lengths, rubber per perimeter | `Shtapik`, `Rubber` |
| `junk_pct` (3) | waste on metre-priced items | `junkPercent` |

`ProfileSystemItem` maps a **role** (`frame`, `sash`, `mullion`, `balcony_frame`, `shtulp`, `bead`,
`rubber_glass`, `rubber_sash`, `glass:<code>`, `hw_tilt_turn`, `hw_turn`, `hw_door`, `hinge_door`, `handle`,
`foam`, `screws`, `service_m2`, …) to a `PriceListItem` and a quantity rule (`bars`, `m`, `m2`, `pcs`,
`per_m2`, `per_sash`). Hardware sets per sash type follow Romchi (`Petlya`, `Handle`, `Shpangilet`, …) but the
counts are table rows the workshop owns.

Seed: the Romchi width table for the series Rombo sells (first: "Rombo Termo 306J 65", bar 6.5 m) — values
marked `needs_check` until task 0.2 confirms them. Romchi's numbers are a start, not the truth for our shop.

## D4. Output goes into the existing hisob-kitob
The engine never prices on its own. "Chizmadan to'ldirish" sums all constructions of the Loyiha (× count),
runs cutting (D5) and writes quantities into the calc's lines matched by price-list item
(`ProjectCalcLine.item`). Lines filled this way get `source = chizma`; manual lines (`qo'lda`, e.g. Demontaj,
Transport) are kept. Rounding, amount, print and contract stay exactly as in `projects` spec.

Rejected: *a separate "construction price"* next to the calc — two totals for one Loyiha, and the contract
already prints from the calc.

## D5. Cutting pools the whole Loyiha
Pieces of all constructions with the same price-list item are cut together: best-fit decreasing, one kerf after
every piece (the cut that frees it), `trim_mm` per bar. Result: bars per item (→ hisob-kitob qty), cut plan per bar, offcuts ≥ `min_offcut_mm`.
Pooling is what the workshop does and saves bars versus "each window on its own bars". Phase 1 is
deterministic BFD (same input → same plan); Romchi's heavier optimisers (genetic, annealing) are an optional
later upgrade behind the same function.

## D6. Order lines and MRP
- If a Loyiha has constructions, its `ProjectItem` lines are derived (product type, area m², count per
  construction) and the items editor is read-only; without constructions nothing changes.
- MRP: for a Loyiha with constructions, `ProjectMaterial` need = engine output (exact metres/pieces in the
  product's stock unit via `PriceListItem → Product`), not BOM explosion. Freeze on confirm is unchanged.

## D7. Snapshot like calcs
On confirm, each construction's engine output is frozen in `ConstructionResult` (pieces, glass, hardware,
system values used). A later change of the profile system never changes a confirmed order's cut list —
same rule as price lists (pricing spec "Price changes don't re-price orders").

## D8. App placement
New app `apps/konstruktor`: `projects ← konstruktor ← mrp`. It imports `pricing` models (read) and calls
`projects` services to write calc lines and items. `projects` never imports it: the card shows the tab
through `projects.extensions.register_detail_block` (same as MRP materials, ADR 0012). ADR 0015.

## Risks
| Risk | Mitigation |
|---|---|
| Romchi deductions don't match our shop | Phase 0 golden fixtures from 5–10 real orders; engine must reproduce the workshop's own cut list ± 1 mm before release |
| Sales won't draw | Templates + numeric entry (w, h, mullion positions) first; drawing by mouse is optional |
| Engine slow on big Loyihas | Pure Python, ~100 pieces per order; cutting is O(n log n) BFD; preview per construction only |
| Price list item names change | Role map points to the item id, not the name; missing map → line "narx ro'yxatida yo'q", no guessing |
