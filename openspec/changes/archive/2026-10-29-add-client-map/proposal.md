# Change: add-client-map

## Why
Sales and installers plan visits and measurements by area: "who else do we have near Kattaqo'rg'on
road?", "which dealers are in the city centre?". Today a client has only a free-text region and address,
and the only coordinates live on single Loyihalar (`location`). A client point on a map answers these
questions at a glance and gives installers a one-tap route.

## What changes
- **clients**: `latitude` / `longitude` (decimal, 6 places ≈ 11 cm, nullable). Both or neither;
  latitude −90…90, longitude −180…180. Tracked in chatter ("Kenglik", "Uzunlik"), so a moved pin shows
  in the history. Exposed in the client list/detail payloads.
- **Map endpoint** `GET /clients/map/`: only clients with a point, one light row each
  (id, code, name, kind, phone, region, segment, manager, lat, lng, active Loyiha count) plus the number
  of matching clients without a point. Same filters as the client list (`q`, `kind`, `segment`,
  `manager`, `region`, `is_active`). Not paginated (the map needs every point).
- **Access**: new page `client_map` "Mijozlar xaritasi", group "CRM", view only. Reading the map also
  requires `clients` view (the map shows client data). Roles that can already view clients get map
  view in the migration; seed roles include it.
- **Frontend**:
  - CRM → "Mijozlar xaritasi" page at `/crm/map`: Leaflet + OpenStreetMap, opens on Samarqand
    (39.6542, 66.9597, zoom 12); pins coloured by kind or segment; nearby pins grouped into clusters;
    popup with name, phone, segment, link to the card; filters search / kind / segment / manager in the
    URL; a list beside the map — clicking a row flies to its pin, clicking a pin highlights the row,
    "only what the map shows" narrows the list to the visible area.
  - Client card → "Lokatsiya" row: small map (click or drag the pin, default Samarqand), paste
    "lat, lng" or a Google / Yandex / OSM link to fill the point, "Xaritada ochish" link, clear.
- **Seed**: demo clients get Samarkand-area points (Tashkent / Fergana ones in their regions).

## Impact
- Tables: `clients_client.latitude`, `clients_client.longitude` (migration `client_coordinates`, also
  grants `client_map` view to roles with `clients` view).
- Endpoints: `GET /api/v1/clients/map/`; client payloads gain `latitude`, `longitude`.
- Registry: `Pages.CLIENT_MAP`.
- Frontend: `leaflet@1.9.4` (+ `@types/leaflet`), lazy-loaded; new nav group "CRM" (shared with the
  CRM/telephony change — same title, so the merge is a one-line union).
- Spec deltas: clients (coordinates, map endpoint), access-control (page `client_map`).
