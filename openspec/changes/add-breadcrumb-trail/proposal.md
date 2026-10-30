# Change: add-breadcrumb-trail

## Why
Work crosses apps: Loyiha → Xarid so'rovi → Buyurtma → Pul so'rovi → RKO. Each record page only linked
to its own list, so the way back to where the user started was lost.

## What changes
Odoo-style breadcrumbs above every page (`lib/trail.ts`, shown by `Shell`): pages visited by following
links are appended; clicking a crumb or the browser back button cuts the trail back to that page; the record
pager and post-save redirects replace the last crumb; a sidebar item, the dashboard, "Yangi loyiha" or a
typed URL starts a new trail. Records name their crumb by their code; lists keep their filters. With no
trail the record header keeps its "← List / code" link. Frontend only.

## Impact
`frontend/src/lib/trail.ts` (new), `components/Shell.tsx`, `components/Record.tsx`. Spec: `platform`.
