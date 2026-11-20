## ADDED Requirements

### Requirement: Compact sidebar
The sidebar SHALL show each menu group as one folding line, with at most one group open at a time. The group
holding the current page SHALL be open when the page loads. A group with a single page the user may see SHALL
be shown as that page. Settings and system pages SHALL be reached through one "Sozlamalar" item that opens a
page listing them as cards; the item SHALL be highlighted on any settings or system page. Pages the user may
not see SHALL appear neither in the sidebar nor on the settings page.

#### Scenario: Current group opens
- WHEN the user opens `/kassa/book`
- THEN the "Moliya" group is open with "Kassa kitobi" highlighted, and the other groups are folded

#### Scenario: One group at a time
- WHEN the "Ombor" group is open and the user clicks "Ta'minot"
- THEN "Ta'minot" opens and "Ombor" folds

#### Scenario: Settings through one item
- WHEN a user with view on "users" and "pricing" only clicks "Sozlamalar"
- THEN the settings page shows two cards, "Foydalanuvchilar" and "Narxlar", and no "Tizim" section
