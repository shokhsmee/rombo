# Tasks: add-loyiha-card-fields

## Backend
- [x] apps/references: RefItem, seed migration, CRUD (read: any user; write: `references` page)
- [x] clients: segment FK; dealer label "Diler / hamkor"
- [x] projects: new fields, ProjectItem lines, ProjectFile, computed totals/debt, refined lock
- [x] files: upload / download / delete endpoints, type + size checks
- [x] chatter: TRACK new fields; events for lines and files
- [x] tests

## Frontend
- [x] Loyiha card in the order of the sales card; lines editor with totals; drawings list
- [x] list: debt + area columns
- [x] client: segment
- [x] Sozlamalar → Ma'lumotnomalar page

## Docs
- [x] archive, merge specs, CHANGELOG

## Verified
- 23 backend tests (6 new); fresh DB migrate + seed + seed_demo.
- Browser: card sections in the sales card's order, live debt, lines totals, advance edit tracked in
  chatter, PDF upload + history line, list m²/debt columns, Ma'lumotnomalar page, 375px without overflow.
