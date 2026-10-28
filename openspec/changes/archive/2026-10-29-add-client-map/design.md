# Design: add-client-map

## Point on the client, not a separate table
Chosen: two nullable decimal columns on `Client`. A client has one place we go to (home, office, dealer
shop); objects of individual orders already have `Project.location`.
Rejected: a `ClientAddress` table with many points — no one asked for several addresses, and it would
make the list/map join heavier. If dealers grow branches, branches become their own model then.
Rejected: PostGIS / GeoDjango — dev runs on SQLite, we only need "show points" and later "nearest N",
which a bounding-box filter on two indexed decimals handles for thousands of clients.

## Decimal(9, 6)
6 decimals ≈ 11 cm — finer than any pin a person drops. `max_digits=9` fits ±180.xxxxxx.
The API rounds extra decimals (pasted Google coordinates have 7+) instead of rejecting them.
Both-or-neither is a service rule (`ValidationFailed`), so imports and scripts get it too.

## Map endpoint instead of the list with `size=10000`
The list serializer carries fields the map does not need and is paginated. `/clients/map/` returns one
light row per client with a point plus `without_point` (how many matching clients still need a pin), so the
page can say "12 ta mijozda lokatsiya yo'q". It reuses the list's filter backends, so `q`, `kind`,
`segment`, `manager`, `region` behave exactly like the list.
"Active Loyiha" = not deleted and not delivered / closed / cancelled. `clients` must not import
`projects` (dependency direction), so the finished statuses are repeated as strings; a test pins them to
`projects.FINISHED_STATUSES`.

## Permission: own page + clients view
`client_map` is its own page so a role can have the client list without the map (or a CRM screen without
editing clients). The rows are client data, so the endpoint also requires `clients` view — a role with
only `client_map` gets 403. Implemented as a small reusable permission factory
`page_required(page, action)` in `apps.access.permissions`, added on the action.
Migration grants `client_map` view to every role that already views clients — otherwise the new menu item
would be invisible to everyone but superusers after deploy.

## Clustering: own grid, no plugin
Rejected: `leaflet.markercluster` — it attaches to a global `L` (needs `window.L` shims under Vite), its
CSS hard-codes colours that ignore our tokens/dark mode, and it is unmaintained since 2021.
Chosen: group pins into a 60 px screen grid on every zoom/move; a group of ≥ 2 becomes a count bubble,
click zooms to its bounds. From zoom 17 on, nothing groups. A few thousand points re-group in a few ms.

## Pins and dark mode
Pins are `divIcon`s with token classes (`bg-accent`, `bg-done`, `bg-warn`…), so they follow light/dark
without hex colours. Leaflet's own chrome (popup, zoom buttons, attribution) is restyled in `index.css`
with tokens; in dark mode the OSM tile pane is inverted with a hue rotate (the usual trick) — readable,
no extra tile provider or API key.

## Default view: Samarqand
The factory and most clients are in Samarqand. The map opens on the city (39.6542, 66.9597, z12)
regardless of where the filtered pins are; "Hammasini ko'rsatish" fits all pins, "Samarqand" returns.
The picker on a card without a point also opens on Samarqand.

## Pasting a point
`parsePoint()` accepts "lat, lng", "lat lng", Google links (`!3d…!4d…`, `@lat,lng`, `q=`/`ll=`), Yandex
(`pt=` / `ll=` / `whatshere[point]=` — note Yandex writes **lng,lat**), OSM (`mlat/mlon`, `#map=z/lat/lng`).
Short links (`maps.app.goo.gl`, `yandex.uz/maps/-/…`) cannot be resolved in the browser (redirect,
CORS) — the field says to open the link and copy the full address.

## Rejected for now
- Address search (Nominatim) in the picker — uzbridge has it, but OSM's Samarkand street data is thin and
  the public Nominatim has usage limits; paste-a-link covers how sales get points today (from Telegram).
- Using a client's Loyiha `location` to auto-fill its point — orders can be at another address.
