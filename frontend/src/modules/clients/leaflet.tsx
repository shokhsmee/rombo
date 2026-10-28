// Maps (Leaflet + OpenStreetMap), loaded lazily like uzbridge's distribution/map.tsx: every client as a
// coloured pin, and the picker that sets a client's point. Colours are token classes, so dark mode just works;
// Leaflet's own chrome is restyled in index.css.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import { KIND_LABEL } from "./api";
import { SAMARQAND, SAMARQAND_ZOOM, type ClientPin, type Point } from "./geo";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CELL = 60; // px: pins closer than this on screen are shown as one bubble
const NO_GROUPING_ZOOM = 17;

function baseMap(el: HTMLElement, center: [number, number] = SAMARQAND, zoom = SAMARQAND_ZOOM) {
  const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(center, zoom);
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(map);
  // the box changes size when the list/map tabs switch on a phone or the sidebar wraps
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(el);
  map.on("unload", () => ro.disconnect());
  return map;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const pinIcon = (tone: string, active: boolean) =>
  L.divIcon({ className: "", html: `<span class="client-pin ${tone}${active ? " is-active" : ""}"></span>`,
    iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -8] });

const groupIcon = (n: number) => {
  const size = n < 10 ? 32 : n < 100 ? 38 : 44;
  return L.divIcon({ className: "", html: `<span class="client-cluster" style="width:${size}px;height:${size}px">${n}</span>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
};

function popupHtml(p: ClientPin) {
  const sub = [p.code, KIND_LABEL[p.kind], p.segment?.name].filter(Boolean).map((x) => esc(x!)).join(" · ");
  return `<div class="client-popup">
    <b>${esc(p.name)}</b>
    <span class="sub">${sub}</span>
    ${p.phone ? `<a href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a>` : ""}
    ${p.manager ? `<span class="sub">Menejer: ${esc(p.manager.name)}</span>` : ""}
    ${p.active_projects ? `<span class="sub">${p.active_projects} ta faol loyiha</span>` : ""}
    <a class="open" href="/clients/${p.id}" data-client="${p.id}">Kartani ochish →</a>
  </div>`;
}

export type Bounds = { south: number; west: number; north: number; east: number };

/**
 * All pins; nearby ones become a count bubble (a 60 px grid in world pixels, so panning never regroups).
 * `focus` flies to a pin and opens it (a click in the list); clicking a pin calls `onSelect`.
 */
export default function ClientsMap({ pins, toneOf, selected, focus, onSelect, onOpen, onBounds, fitKey, homeKey }: {
  pins: ClientPin[];
  toneOf: (p: ClientPin) => string;
  selected: number | null;
  focus: { id: number; n: number } | null;
  onSelect: (id: number) => void;
  onOpen: (id: number) => void;
  onBounds: (b: Bounds) => void;
  fitKey: number; // bump to fit every pin
  homeKey: number; // bump to go back to Samarqand
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<number, L.Marker>());
  const pending = useRef<number | null>(null); // pin to open once the regroup after a fly has drawn it
  const cb = useRef({ onSelect, onOpen, onBounds, toneOf });
  cb.current = { onSelect, onOpen, onBounds, toneOf };
  const state = useRef({ pins, selected });
  state.current = { pins, selected };

  const draw = () => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current.clear();
    const z = m.getZoom();
    const cells = new Map<string, ClientPin[]>();
    for (const p of state.current.pins) {
      const key = z >= NO_GROUPING_ZOOM ? `p${p.id}` : (() => {
        const xy = m.project([p.lat, p.lng], z);
        return `${Math.floor(xy.x / CELL)}:${Math.floor(xy.y / CELL)}`;
      })();
      const cell = cells.get(key);
      if (cell) cell.push(p);
      else cells.set(key, [p]);
    }
    for (const group of cells.values()) {
      if (group.length === 1) {
        const p = group[0];
        const mk = L.marker([p.lat, p.lng], { icon: pinIcon(cb.current.toneOf(p), p.id === state.current.selected),
          zIndexOffset: p.id === state.current.selected ? 1000 : 0, keyboard: true, title: p.name })
          .bindPopup(popupHtml(p), { minWidth: 200, maxWidth: 260 })
          .on("click", () => cb.current.onSelect(p.id))
          .addTo(g);
        markers.current.set(p.id, mk);
      } else {
        const b = L.latLngBounds(group.map((p) => [p.lat, p.lng] as [number, number]));
        L.marker(b.getCenter(), { icon: groupIcon(group.length), title: `${group.length} ta mijoz` })
          .on("click", () => m.fitBounds(b, { padding: [48, 48], maxZoom: NO_GROUPING_ZOOM }))
          .addTo(g);
      }
    }
    if (pending.current != null) {
      markers.current.get(pending.current)?.openPopup();
      pending.current = null;
    }
  };

  useEffect(() => {
    if (!box.current) return;
    const m = baseMap(box.current);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    const report = () => {
      const b = m.getBounds();
      cb.current.onBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    };
    m.on("zoomend", draw);
    m.on("moveend", report);
    report();
    const el = box.current;
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("[data-client]");
      if (a && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        cb.current.onOpen(Number(a.getAttribute("data-client")));
      }
    };
    el.addEventListener("click", click);
    return () => { el.removeEventListener("click", click); m.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(draw, [pins, toneOf]); // eslint-disable-line react-hooks/exhaustive-deps

  // selection only restyles two pins — a full redraw would close the popup the click just opened
  const shown = useRef<number | null>(null);
  useEffect(() => {
    for (const id of [shown.current, selected]) {
      const mk = id != null && markers.current.get(id);
      const p = mk && pins.find((x) => x.id === id);
      if (mk && p) {
        mk.setIcon(pinIcon(cb.current.toneOf(p), id === selected));
        mk.setZIndexOffset(id === selected ? 1000 : 0);
      }
    }
    shown.current = selected;
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    const p = focus && pins.find((x) => x.id === focus.id);
    if (!m || !p) return;
    pending.current = p.id;
    if (m.getZoom() >= NO_GROUPING_ZOOM && m.getBounds().contains([p.lat, p.lng])) draw();
    else m.flyTo([p.lat, p.lng], NO_GROUPING_ZOOM, { duration: 0.6 });
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m || !fitKey || !pins.length) return;
    if (pins.length === 1) m.setView([pins[0].lat, pins[0].lng], 15);
    else m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (homeKey) map.current?.setView(SAMARQAND, SAMARQAND_ZOOM);
  }, [homeKey]);

  return <div ref={box} className="leaflet-box size-full" />;
}

/** Set a point: click the map or drag the pin. Opens on the point, or on Samarqand when there is none. */
export function PinPicker({ value, onChange, disabled }: { value: Point | null; onChange: (p: Point) => void; disabled?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const off = useRef(disabled);
  off.current = disabled;
  const pick = (ll: L.LatLng) => change.current({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) });

  useEffect(() => {
    if (!box.current) return;
    const m = baseMap(box.current, value ? [value.lat, value.lng] : SAMARQAND, value ? 16 : SAMARQAND_ZOOM);
    map.current = m;
    m.on("click", (e: L.LeafletMouseEvent) => { if (!off.current) pick(e.latlng); });
    return () => { m.remove(); map.current = null; pin.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    const ll: [number, number] = [value.lat, value.lng];
    if (!pin.current) {
      pin.current = L.marker(ll, { draggable: !disabled, icon: pinIcon("bg-accent", true), autoPan: true }).addTo(m);
      pin.current.on("dragend", () => pick(pin.current!.getLatLng()));
    } else pin.current.setLatLng(ll);
    if (!m.getBounds().pad(-0.1).contains(ll)) m.setView(ll, Math.max(m.getZoom(), 15)); // pasted far away
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (disabled) pin.current?.dragging?.disable();
    else pin.current?.dragging?.enable();
  }, [disabled]);

  return <div ref={box} className={`leaflet-box h-56 w-full rounded-lg border border-line ${disabled ? "" : "cursor-crosshair"}`} />;
}
