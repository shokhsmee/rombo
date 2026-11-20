## ADDED Requirements

### Requirement: User guide
The app SHALL have a Qo'llanma page at `/guide`, reachable from the sidebar, with chapters that explain each
module's workflow in Uzbek: text, numbered steps, tips, FAQ and screenshots whose red numbered marks are
explained under the picture in the same order. A chapter tied to pages SHALL be listed only when the user may
view at least one of them. The chapter in the URL hash SHALL open directly (`/guide#konstruktor`).

#### Scenario: Chapters follow permissions
- WHEN a user whose role sees only "kassa" and "cash_orders" opens `/guide`
- THEN the list shows the Boshlash chapters and the Kassa chapters, and no Loyiha or Ta'minot chapter

#### Scenario: Link to a chapter
- WHEN `/guide#konstruktor` is opened
- THEN the "Chizmalar — Konstruktor" chapter is shown and highlighted in the list

#### Scenario: Picture full size
- WHEN the user clicks a screenshot
- THEN it opens over the page at full size and Esc closes it
