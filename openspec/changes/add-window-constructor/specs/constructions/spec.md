## ADDED Requirements

### Requirement: Profile system
A profile system SHALL have a unique name, a price list, bar length (mm), kerf (mm, default 5), end trim (mm),
frame / sash / mullion widths, weld, mullion and sash allowances, glass and bead deductions, waste % for
metre items (default 3), active flag, and items mapping a role to a price-list item of its price list with a
quantity rule (`bars | m | m2 | pcs | per_m2 | per_sash`). A role appears once per system. Page `profile_systems`.

#### Scenario: Item from another price list
- WHEN a system on "Rombo Termo 306J 65 seriya" maps role `frame` to an item of another price list
- THEN 400 on that item's `price_list_item`

#### Scenario: Negative width
- WHEN `frame_width` is saved as -1
- THEN 400 on `frame_width`

### Requirement: Construction
A Loyiha SHALL have constructions with code `KS-NNNNN`, name, profile system, product type, count ≥ 1 and a
design: outer width and height (mm, 300–6000) and a tree of cells, where a cell is a leaf (fill `glass | panel |
lambri`, optional sash `fixed | turn | tilt | tilt_turn | door` with hinge side) or a split (`v | h`) with
mullion positions strictly inside it, leaving every cell ≥ 150 mm. Constructions lock with the Loyiha's
production fields. Changes are written to chatter.

#### Scenario: Mullion outside the frame
- WHEN a 1200 mm wide construction has a vertical mullion at 1250
- THEN 400 "Impost rom tashqarisida"

#### Scenario: Locked Loyiha
- WHEN a construction of a Loyiha in `production` is edited by a user without the unlock right
- THEN 409

### Requirement: Engine output
The engine SHALL turn a construction into pieces (role, cut length mm, count), glass panes (w × h mm, m²),
beads and rubber (m), hardware (pcs) and area (m² of the outer size), using only the values of its profile
system; the same input SHALL always give the same output. Frame pieces are the outer side + 2 × weld
allowance; a mullion is the clear span between the frame profiles + mullion allowance; glass is the light
opening − the glass deduction.

#### Scenario: Fixed window
- WHEN a 1200 × 1400 fixed window is calculated with frame width 60, weld allowance 3 and fixed-glass deduction 10
- THEN frame pieces are 2 × 1206 and 2 × 1406, the glass is 1070 × 1270 (1.359 m²) and the area is 1.68 m²

#### Scenario: Two cells
- WHEN the same window has a vertical mullion at 600 and mullion allowance 6
- THEN there is one mullion piece of 1286 and two glass cells

#### Scenario: Sash hardware
- WHEN the right cell has a `tilt_turn` sash and the system maps `hw_tilt_turn` per sash
- THEN the hardware has 1 × the `hw_tilt_turn` item and the sash adds 4 sash-profile pieces

### Requirement: Preview
`POST /konstruktor/constructions/preview/ {system_id, design, count}` SHALL return the engine output and,
per mapped item, quantity and price from the system's price list, without saving anything. Needs
`constructions.view`.

#### Scenario: Unmapped glass
- WHEN the design uses glass `pakt_kolon` and the system has no `glass:pakt_kolon` role
- THEN the preview lists it under `unmapped` with its m² and no price

### Requirement: Cutting
The cut plan of a Loyiha SHALL pool all pieces of all its constructions (× count) per price-list item and place
them on bars by best-fit decreasing, with one kerf after every piece and trim per bar; it returns bars per item, each
bar's pieces and offcut. A piece longer than the bar minus trim is refused with its construction.

#### Scenario: One bar
- WHEN pieces 1406, 1406, 1206, 1206 are cut from 6500 mm bars with kerf 5 and trim 0
- THEN they fit on 1 bar with an offcut of 1256

#### Scenario: Too long
- WHEN a construction needs a 6800 mm frame piece and the bar is 6500
- THEN 400 naming that construction: "Profil xlistdan uzun"

### Requirement: Frozen on confirm
When the Loyiha moves to `confirmed`, each construction's engine output and the profile-system values used
SHALL be stored and stop following later system changes.

#### Scenario: Allowance changed later
- WHEN the weld allowance changes after the Loyiha was confirmed
- THEN its cut list and pieces stay as they were
