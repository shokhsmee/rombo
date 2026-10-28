// Live updates over /ws/live/ (backend apps/core/consumers.py; ported from uzbridge crm/live.tsx).
// One socket per tab, opened while signed in. Pushes refresh the board, the call log, Telegram; a "notify"
// shows a toast that opens the lead. Reconnects with backoff; a ping every 25 s keeps proxies from closing it.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";

import { toast } from "@/components/toast";
import { tokens } from "@/lib/api";

type Listener<T> = (v: T) => void;

export function bus<T>() {
  const ls = new Set<Listener<T>>();
  return {
    on(l: Listener<T>) { ls.add(l); return () => { ls.delete(l); }; },
    emit(v: T) { ls.forEach((l) => l(v)); },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LiveMessage = { type: string; [k: string]: any };
/** Every push, for pages that react to their own kind (the call popup, Telegram). */
export const liveEvents = bus<LiveMessage>();

let connected = false;
const statusListeners = new Set<() => void>();
const setConnected = (v: boolean) => { connected = v; statusListeners.forEach((l) => l()); };
/** True while the socket is open: polling fallbacks slow down then. */
export const useLiveConnected = () =>
  useSyncExternalStore((cb) => { statusListeners.add(cb); return () => { statusListeners.delete(cb); }; }, () => connected);

export function useLiveSocket(on: boolean) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    if (!on) return;
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let pending: number | undefined;
    let tries = 0;
    let gone = false;
    const refresh = (keys: string[][]) => {
      // many changes in a row (a sync, a bulk action) → at most one refresh a second
      if (pending) return;
      pending = window.setTimeout(() => {
        pending = undefined;
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      }, 800);
    };
    const connect = () => {
      const token = tokens.access;
      if (!token) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws/live/?token=${encodeURIComponent(token)}`);
      socket.onopen = () => { tries = 0; setConnected(true); };
      socket.onmessage = (e) => {
        let m: LiveMessage;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === "ping") return;
        liveEvents.emit(m);
        if (m.type === "crm") refresh([["crm/leads"], ["crm/tasks"], ["crm/pipelines"], ["chatter"]]);
        else if (m.type === "calls" || m.type === "sync") refresh([["telephony/calls"], ["crm/connections"], ["crm/leads"]]);
        else if (m.type === "notify") toast.info(m.title, m.body, m.link ? () => navigate(m.link) : undefined);
      };
      socket.onclose = (e) => {
        setConnected(false);
        if (gone) return;
        tries += 1;
        // 4401: the access token expired — the API refreshes it on its next call, so try again a bit later
        timer = window.setTimeout(connect, e.code === 4401 ? 30_000 : Math.min(30_000, 1500 * tries));
      };
    };
    connect();
    return () => {
      gone = true;
      window.clearTimeout(timer);
      window.clearTimeout(pending);
      socket?.close();
      setConnected(false);
    };
  }, [on, qc, navigate]);
}
