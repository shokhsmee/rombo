# ADR 0006 — uzbridge is the house style: Tailwind v4 + own kit (supersedes the UI part of ADR 0001)

- Status: accepted
- Date: 2026-10-29
- Supersedes: ADR 0001, "Frontend: … Mantine 7"

## Context
The first frontend used Mantine. The product owner found it too plain and asked for the look and
record-page patterns of uzbridge, our existing product.

## Decision
- Tailwind v4 with uzbridge's token names (`ground/surface/sunk/ink/muted/faint/line/accent` + status
  pairs), Onest + JetBrains Mono, light/dark/system theme. Rombo's accent is blue.
- A small in-repo kit (`components/ui.tsx`, `Record.tsx`, `Chatter.tsx`) copied from uzbridge's shapes.
- lucide-react icons. Mantine and Tabler icons removed.

## Why
uzbridge's look is its tokens and ~200 lines of components; re-theming Mantine would never match it.
Owning the kit keeps both products consistent and the bundle smaller (≈500 kB → 359 kB JS).

## Consequences
We maintain a few widgets ourselves (remote combobox, dialog, toast). Dates use native `<input type="date">`.
