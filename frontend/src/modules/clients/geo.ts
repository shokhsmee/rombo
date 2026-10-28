// Client points: the map endpoint, defaults, and reading a point out of whatever sales paste
// ("39.65, 66.95", a Google / Yandex / OSM link). Kept free of Leaflet so pages load it eagerly.
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, cleanParams, type Ref } from "@/lib/api";

import type { ClientKind } from "./api";

/** Samarqand shahri — where the factory and most clients are. Maps open here. */
export const SAMARQAND: [number, number] = [39.6542, 66.9597];
export const SAMARQAND_ZOOM = 12;

export type Point = { lat: number; lng: number };

export type ClientPin = {
  id: number;
  code: string;
  name: string;
  kind: ClientKind;
  phone: string;
  region: string;
  segment: { id: number; name: string } | null;
  manager: Ref | null;
  lat: number;
  lng: number;
  active_projects: number;
};

export type ClientMap = { items: ClientPin[]; total: number; without_point: number };

export function useClientMap(query: Record<string, unknown>) {
  return useQuery({
    queryKey: ["clients", "map", query],
    queryFn: async () => (await api.get<ClientMap>("/clients/map/", { params: cleanParams(query) })).data,
    placeholderData: keepPreviousData,
  });
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function valid(lat: number, lng: number): Point | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: round6(lat), lng: round6(lng) };
}

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

/**
 * A point from pasted text, or null. Order of trust inside a link: the place's own pin first
 * (Google `!3d…!4d…`, Yandex `pt=`), then the viewport centre (`@lat,lng`, `ll=`).
 * Yandex writes longitude first.
 */
export function parsePoint(raw: string): Point | null {
  const text = raw.trim();
  if (!text) return null;
  let s = text;
  try {
    s = decodeURIComponent(text);
  } catch {
    // keep as is
  }
  const m = (re: RegExp) => s.match(re);
  let r: RegExpMatchArray | null;

  if (/yandex\.|ya\.ru/.test(s)) {
    if ((r = m(new RegExp(String.raw`[?&](?:pt|whatshere\[point\])=${NUM},${NUM}`)))) return valid(+r[2], +r[1]);
    if ((r = m(new RegExp(String.raw`[?&]ll=${NUM},${NUM}`)))) return valid(+r[2], +r[1]);
  }
  if ((r = m(new RegExp(String.raw`!3d${NUM}!4d${NUM}`)))) return valid(+r[1], +r[2]); // Google place pin
  if ((r = m(new RegExp(String.raw`[?&]mlat=${NUM}&mlon=${NUM}`)))) return valid(+r[1], +r[2]); // OSM marker
  if ((r = m(new RegExp(String.raw`#map=\d+(?:\.\d+)?/${NUM}/${NUM}`)))) return valid(+r[1], +r[2]); // OSM view
  if ((r = m(new RegExp(String.raw`[?&](?:q|query|ll|destination|center)=${NUM},\s*${NUM}`)))) return valid(+r[1], +r[2]);
  if ((r = m(new RegExp(String.raw`@${NUM},${NUM}`)))) return valid(+r[1], +r[2]); // Google viewport
  // plain "39.6542, 66.9597" / "39.6542 66.9597" / "39.6542;66.9597"
  if ((r = text.match(new RegExp(String.raw`^${NUM}\s*[,;\s]\s*${NUM}$`)))) return valid(+r[1], +r[2]);
  return null;
}

/** Short share links redirect on the provider's side; the browser can't follow them (CORS). */
export const isShortLink = (s: string) => /maps\.app\.goo\.gl|goo\.gl\/maps|yandex\.[a-z]+\/maps\/-\//.test(s);

export const fmtPoint = (p: Point) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

/** Opens the phone's maps app (or Google Maps on desktop) at the point — for routes to the client. */
export const mapsUrl = (p: Point) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
