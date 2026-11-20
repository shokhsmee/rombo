# Change: simplify-sidebar

## Why
The sidebar lists about 40 pages in 11 groups, all open at once. Users scroll and scan a long column to find
the two or three pages they use; settings pages that are opened once a month take a third of it.

## What changes
- Sidebar groups fold: each group is one line (icon + title + chevron). Clicking it opens its pages; one group
  is open at a time. The group of the current page opens by itself. A group with one visible page is shown as
  that page directly (Xodimlar).
- "Sozlamalar" and "Tizim" leave the sidebar and become one item **Sozlamalar** (`/settings`) that opens a
  page of cards: every settings and system page the user may see, in two sections. The item stays highlighted
  on every `/settings/*` and `/system/*` page.
- Phone width (top scrolling strip) keeps showing pages flat, as today.
- Menu definition moves from `components/Shell.tsx` to `components/nav.ts`, shared by the sidebar and the
  settings page.

## Impact
- Frontend only: `components/Shell.tsx`, new `components/nav.ts`, new `modules/settings/SettingsHomePage.tsx`,
  route `/settings` in `App.tsx`. No backend, tables or permissions change; pages are still filtered by `can()`.
- Spec: `platform` — new requirement "Compact sidebar".
