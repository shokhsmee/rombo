# Tasks: add-client-map

## Backend
- [x] clients: `latitude` / `longitude` Decimal(9,6), range validators, TRACK labels
- [x] service rule: both or neither (`ValidationFailed`)
- [x] serializers: expose coordinates, round extra decimals
- [x] `GET /clients/map/` with list filters, active Loyiha count, `without_point`
- [x] registry `client_map` (group CRM); `page_required` permission; migration `client_coordinates`
      (+ grant to roles with clients view); seed roles
- [x] tests: validation, filtering, permission, chatter

## Frontend
- [x] `leaflet@1.9.4` pinned, lazy-loaded map module; Leaflet chrome restyled with tokens, dark tiles
- [x] `/crm/map` page: Samarqand default, coloured pins (kind / segment), grid clusters, popups,
      filters in URL, list ↔ map sync
- [x] client card "Lokatsiya" row: pin picker, paste parser, open-in-maps link
- [x] nav group "CRM" → "Mijozlar xaritasi"; `PageKey` += `client_map`

## Seed
- [x] demo clients get coordinates

## Docs
- [x] archive, merge specs, CHANGELOG

## Verified
- 30 backend tests (7 new in `apps/clients/tests.py`); `tsc -b` + `vite build` (Leaflet in its own lazy chunk).
- `parsePoint` against 14 inputs: plain pairs, Google `!3d!4d` / `@` / `q=`, Yandex `ll=` / `pt=` /
  `whatshere`, OSM `mlat` / `#map`, short link and out-of-range rejected.
- Browser, fresh DB (migrate + seed + seed_demo): `/crm/map` opens on Samarqand; list click flies to the
  pin and opens its popup; pin click highlights the row; "Hammasi" groups the 5 city pins into a bubble;
  segment colours + legend; visible-area filter; "Kartani ochish" opens the card. Client card: pasted
  Yandex link → point, map click moves the pin, save → "Kenglik / Uzunlik" in chatter. Dark and light;
  375 px without horizontal scroll (map page and client card).
