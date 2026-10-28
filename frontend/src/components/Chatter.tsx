// A record's history (ported from uzbridge components/Chatter.tsx): a note box always at hand, then a
// timeline — notes, events and tracked field changes ("Holat: Qoralama → Tasdiqlangan") with who and when.
// <ChatterPanel model="projects.project" id={21} /> is the side column; folding it is remembered per browser.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, MessageSquareText, PanelRightClose, PanelRightOpen, PenLine, SendHorizontal, Sparkles } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { api, apiError } from "@/lib/api";

import { ErrorNote } from "./ui";

type Msg = {
  id: number;
  kind: "note" | "event" | "track";
  body: string;
  changes: { field: string; label: string; old: string; new: string }[];
  author: string;
  created_at: string;
};
type Filter = "all" | "note" | "change";

export const chatterKey = (model: string, id: number) => ["chatter", model, id];

function useHistory(model: string, id: number) {
  return useQuery({
    queryKey: chatterKey(model, id),
    queryFn: async () => (await api.get<Msg[]>("/chatter/", { params: { model, res_id: id } })).data,
    refetchInterval: 30_000,
  });
}

// ------------------------------------------------------------------ open / folded, remembered

const OPEN_KEY = "rombo-chatter-open";
const listeners = new Set<() => void>();
function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}
export function useChatterOpen(): [boolean, (v: boolean) => void] {
  const open = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, readOpen, () => true);
  const set = (v: boolean) => {
    try {
      localStorage.setItem(OPEN_KEY, v ? "1" : "0");
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    listeners.forEach((l) => l());
  };
  return [open, set];
}

export function ChatterPanel({ model, id, title = "Tarix" }: { model: string; id: number; title?: string }) {
  const [, setOpen] = useChatterOpen();
  const q = useHistory(model, id);
  return (
    <section className="grid content-start gap-3 rounded-2xl border border-line bg-gradient-to-b from-surface to-ground/40 p-4 shadow-sm">
      <header className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-xl bg-accent-soft text-accent-ink"><History className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted">{q.data ? `${q.data.length} ta yozuv` : "…"}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} title="Yashirish" aria-label="Tarixni yashirish"
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ground hover:text-ink">
          <PanelRightClose className="size-4" />
        </button>
      </header>
      <Chatter model={model} id={id} />
    </section>
  );
}

export function ChatterReopen({ model, id }: { model: string; id: number }) {
  const [, setOpen] = useChatterOpen();
  const q = useHistory(model, id);
  return (
    <button type="button" onClick={() => setOpen(true)}
      className="press fixed bottom-5 right-5 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-4 text-sm font-medium shadow-lg hover:border-accent">
      <PanelRightOpen className="size-4 text-accent-ink" />
      Tarix
      {!!q.data?.length && <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-white">{q.data.length}</span>}
    </button>
  );
}

// ------------------------------------------------------------------ the history itself

export default function Chatter({ model, id }: { model: string; id: number }) {
  const qc = useQueryClient();
  const q = useHistory(model, id);
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const send = useMutation({
    mutationFn: async () => (await api.post<Msg>("/chatter/", { model, res_id: id, body: text })).data,
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: chatterKey(model, id) }); },
  });
  const all = q.data ?? [];
  const rows = all.filter((m) => filter === "all" || (filter === "note" ? m.kind === "note" : m.kind !== "note"));
  const days: [string, Msg[]][] = [];
  for (const m of rows) {
    const d = dayLabel(m.created_at);
    const last = days.at(-1);
    if (last && last[0] === d) last[1].push(m);
    else days.push([d, [m]]);
  }
  const notes = all.filter((m) => m.kind === "note").length;
  const chips: [Filter, string, number][] = [["all", "Hammasi", all.length], ["note", "Izohlar", notes], ["change", "O'zgarishlar", all.length - notes]];

  return (
    <div className="grid content-start gap-3">
      <div className={`rounded-xl border bg-surface transition-colors ${focus || text ? "border-accent shadow-sm" : "border-line"}`}>
        <textarea
          value={text}
          rows={focus || text ? 3 : 1}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim() && send.mutate()}
          placeholder="Izoh qoldiring…"
          className="block w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-sm focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <span className="pl-1 text-xs text-muted">{focus || text ? "Ctrl + Enter" : ""}</span>
          <button type="button" disabled={!text.trim() || send.isPending} onMouseDown={(e) => e.preventDefault()} onClick={() => send.mutate()}
            className="grid size-8 place-items-center rounded-lg bg-accent text-white transition-opacity disabled:opacity-30" aria-label="Yuborish">
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
      <ErrorNote error={send.error ? apiError(send.error).message : q.error ? apiError(q.error).message : null} />
      {all.length > 0 && (
        <div className="flex gap-1 rounded-lg bg-ground/70 p-0.5 text-xs">
          {chips.map(([k, label, n]) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              className={`flex-1 rounded-md px-2 py-1 ${filter === k ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
              {label} <span className="tabular opacity-60">{n}</span>
            </button>
          ))}
        </div>
      )}
      {q.isLoading && <div className="h-24 animate-pulse rounded-xl bg-surface" />}
      {days.map(([d, msgs]) => (
        <div key={d} className="grid">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{d}</p>
          <ol className="relative grid gap-3 border-l border-line pl-4">
            {msgs.map((m) => <Entry key={m.id} m={m} />)}
          </ol>
        </div>
      ))}
      {!q.isLoading && !rows.length && (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
          {all.length ? "Bu turdagi yozuv yo'q." : "Hali tarix yo'q — birinchi izohni yozing."}
        </p>
      )}
    </div>
  );
}

function Entry({ m }: { m: Msg }) {
  const Icon = m.kind === "note" ? MessageSquareText : m.kind === "track" ? PenLine : Sparkles;
  const node = m.kind === "note" ? "bg-warn-soft text-warn ring-warn/30" : m.kind === "track" ? "bg-ground text-muted ring-line" : "bg-accent-soft text-accent-ink ring-accent/30";
  return (
    <li className="relative">
      <span className={`absolute -left-[27px] top-0.5 grid size-5 place-items-center rounded-full ring-2 ${node}`}><Icon className="size-3" /></span>
      <p className="flex items-baseline gap-1.5 text-xs">
        <b className="truncate font-semibold">{m.author || "Tizim"}</b>
        <span className="shrink-0 text-muted" title={new Date(m.created_at).toLocaleString("ru-RU")}>{ago(m.created_at)}</span>
      </p>
      {m.body && (
        <p className={`mt-1 whitespace-pre-wrap break-words text-sm ${m.kind === "note" ? "rounded-xl bg-warn-soft/50 px-3 py-2" : "text-ink"}`}>{m.body}</p>
      )}
      {m.changes.length > 0 && (
        <div className="mt-1 grid gap-1">
          {m.changes.map((c) => (
            <div key={c.field} className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted">{c.label}:</span>
              <span className="rounded-md bg-ground px-1.5 py-0.5 text-muted line-through decoration-muted/50">{c.old || "—"}</span>
              <span className="text-muted">→</span>
              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent-ink">{c.new || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Bugun";
  if (d.toDateString() === y.toDateString()) return "Kecha";
  return d.toLocaleDateString("ru-RU");
}

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} daq. oldin`;
  if (min < 60 * 24 && new Date(iso).toDateString() === new Date().toDateString()) return `${Math.round(min / 60)} soat oldin`;
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
