// Odoo-style breadcrumbs across apps: Loyiha → Xarid so'rovi → Buyurtma → Pul so'rovi keeps the way back.
//
// One trail per browser tab (sessionStorage). Shell feeds every page visit; record pages give their own
// label (RecordNav). Rules:
//   • a sidebar click, the dashboard or "Yangi loyiha" starts a new trail (reset);
//   • visiting a page already in the trail cuts the trail back to it (crumb click, browser back);
//   • a REPLACE navigation (pager, /new → /42 after save) swaps the last crumb;
//   • anything else is appended. A list page is one crumb whatever its filters; the crumb remembers them.
import { useSyncExternalStore } from "react";

export type Crumb = { path: string; to: string; label: string };

const KEY = "rombo.trail";
const MAX = 8;

let trail: Crumb[] = load();
// a typed URL or a fresh tab starts a new trail; a reload of a page on the trail keeps it
let resetNext = true;
let firstVisit = true;
// a record page may name itself before Shell records the visit (child effects run first): remember it
const names = new Map<string, string>();
const listeners = new Set<() => void>();

function load(): Crumb[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Crumb[]) : [];
  } catch {
    return [];
  }
}

function set(next: Crumb[]) {
  trail = next.slice(-MAX);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    /* private mode: the trail just isn't kept across reloads */
  }
  listeners.forEach((l) => l());
}

/** The next visit starts a fresh trail (sidebar, dashboard, header shortcuts). */
export function resetTrail() {
  resetNext = true;
}

/** Called by Shell on every location change. */
export function visit(path: string, search: string, label: string, replace: boolean) {
  const crumb: Crumb = { path, to: path + search, label: names.get(path) ?? label };
  if (firstVisit) {
    firstVisit = false;
    if (trail.some((c) => c.path === path)) resetNext = false;  // reload: keep the trail
  }
  if (resetNext || !trail.length) {
    resetNext = false;
    set([crumb]);
    return;
  }
  const at = trail.findIndex((c) => c.path === path);
  if (at >= 0) {
    // back to a page on the trail: cut after it, keep its label, refresh its filters
    set([...trail.slice(0, at), { ...trail[at], to: crumb.to }]);
    return;
  }
  if (replace) {
    set([...trail.slice(0, -1), crumb]);
    return;
  }
  set([...trail, crumb]);
}

/** A record page names itself ("LY-26-00007") once its data is loaded. */
export function nameCurrent(path: string, label: string) {
  names.set(path, label);
  const last = trail[trail.length - 1];
  if (!last || last.path !== path || last.label === label) return;
  set([...trail.slice(0, -1), { ...last, label }]);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTrail(): Crumb[] {
  return useSyncExternalStore(subscribe, () => trail);
}
