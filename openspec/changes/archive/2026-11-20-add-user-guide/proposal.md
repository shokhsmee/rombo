# Change: add-user-guide

## Why
New staff learn Rombo ERP by asking a colleague. Nothing in the app explains how a Loyiha moves from a draft to
closing, how a window is drawn in the Konstruktor, or how purchasing, the warehouse and the kassa connect.

## What changes
- **Qo'llanma** page (`/guide`) and a sidebar item: chapters grouped by part (Boshlash, Savdo, CRM, Servis,
  Ta'minot, Ishlab chiqarish, Ombor, Moliya, Buxgalteriya, Xodimlar, Sozlamalar). Each chapter has blocks of
  text, numbered steps, bullet points, tips, FAQ and annotated screenshots: red numbered marks on the picture,
  explained under it; a click opens the picture full size.
- A chapter shows only when the user may open one of its pages (`pages` → `can(page)`); the Boshlash part is for
  everyone.
- Chapters live in `frontend/src/modules/guide/chapters/<module>.ts` (Uzbek). Pictures are WebP files in
  `frontend/public/guide/<module>/`, made by `backend/scripts/guide_shots.py` from the local demo data
  (`seed_demo`) with Playwright: one spec per chapter in `backend/scripts/guide/<module>.py`. Re-run after UI changes.
  Names and phones typed by hand into a local DB are swapped for made-up ones in the page before each shot.

## Impact
- Frontend: `modules/guide/*`, route `/guide`, sidebar item, crumb label. Static pictures under `public/guide/`.
- Backend: dev-only script `scripts/guide_shots.py` + `scripts/guide/*.py` (not imported by the app).
- No tables, endpoints or permissions change.
- Spec: `platform` — new requirement "User guide".
