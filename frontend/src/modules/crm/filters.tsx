// Voronka filters (ported from uzbridge crm/filters.tsx): quick views, a panel, chips, saved presets.
// Almost everything filters the board's cards in the browser; the server gets only what changes the card set:
// closed=all (won / lost asked for), created_from / created_to (the period), the pipeline.
import dayjs from "dayjs";
import { Bookmark, Filter as FilterIcon, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Input, Pill } from "@/components/ui";

import { fieldText, type FieldValue, type LeadCard, type LeadField, type LeadStatus, type Stage } from "./api";

export type Range = { min?: string; max?: string };
export type Filter = {
  q: string;
  quick: string;
  statuses: LeadStatus[];
  stages: number[];
  managers: number[]; // 0 = no manager
  task: "" | "none" | "overdue" | "today" | "tomorrow" | "week";
  sources: string[];
  tags: string[];
  period: "" | "today" | "yesterday" | "week" | "month" | "last_month" | "custom";
  from: string;
  to: string;
  budget: Range;
  custom: Record<string, string[] | Range | string>;
};

export const EMPTY: Filter = {
  q: "", quick: "", statuses: [], stages: [], managers: [], task: "", sources: [], tags: [], period: "", from: "", to: "",
  budget: {}, custom: {},
};

const STALE_MS = 3 * 86_400_000;

export const QUICK: [string, string][] = [
  ["", "Barchasi"], ["mine", "Meniki"], ["today_tasks", "Bugungi vazifalar"], ["overdue", "Muddati o'tgan"],
  ["no_task", "Vazifasiz"], ["new", "Bugun kelgan"], ["stale", "3 kundan beri jim"], ["missed", "O'tkazilgan qo'ng'iroq"],
  ["dup", "Dubllar"], ["won", "Yutilgan"], ["lost", "Rad etilgan"],
];

const PERIODS: [Filter["period"], string][] = [
  ["today", "Bugun"], ["yesterday", "Kecha"], ["week", "Shu hafta"], ["month", "Shu oy"], ["last_month", "O'tgan oy"],
  ["custom", "Davr…"],
];
const TASKS: [Filter["task"], string][] = [
  ["none", "Vazifasiz"], ["overdue", "Muddati o'tgan"], ["today", "Bugun"], ["tomorrow", "Ertaga"], ["week", "7 kun ichida"],
];

function periodRange(f: Filter): [string, string] | null {
  const d = dayjs();
  switch (f.period) {
    case "today": return [d.format("YYYY-MM-DD"), d.format("YYYY-MM-DD")];
    case "yesterday": return [d.subtract(1, "day").format("YYYY-MM-DD"), d.subtract(1, "day").format("YYYY-MM-DD")];
    case "week": { const mon = d.subtract((d.day() + 6) % 7, "day"); return [mon.format("YYYY-MM-DD"), d.format("YYYY-MM-DD")]; }
    case "month": return [d.startOf("month").format("YYYY-MM-DD"), d.format("YYYY-MM-DD")];
    case "last_month": { const m = d.subtract(1, "month"); return [m.startOf("month").format("YYYY-MM-DD"), m.endOf("month").format("YYYY-MM-DD")]; }
    case "custom": return f.from || f.to ? [f.from, f.to] : null;
    default: return null;
  }
}

/** What the board endpoint needs to load the right cards. */
export function serverParams(f: Filter): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.quick === "won" || f.quick === "lost" || f.statuses.some((s) => s !== "open")) out.closed = "all";
  const r = periodRange(f);
  if (r) { if (r[0]) out.created_from = r[0]; if (r[1]) out.created_to = r[1]; }
  return out;
}

const inRange = (v: number, r: Range) => (!r.min || v >= Number(r.min)) && (!r.max || v <= Number(r.max));

export function matches(l: LeadCard, f: Filter, meId: number | null, fields: LeadField[]): boolean {
  const now = Date.now();
  const today = dayjs().endOf("day").valueOf();
  const due = l.next_task_due ? new Date(l.next_task_due).getTime() : null;
  switch (f.quick) {
    case "mine": if (!meId || l.manager?.id !== meId) return false; break;
    case "today_tasks": if (!due || due > today) return false; break;
    case "overdue": if (!l.overdue) return false; break;
    case "no_task": if (l.status !== "open" || l.open_tasks) return false; break;
    case "new": if (!dayjs(l.created_at).isSame(dayjs(), "day")) return false; break;
    case "stale": if (l.status !== "open" || now - new Date(l.last_activity_at ?? l.created_at).getTime() < STALE_MS) return false; break;
    case "missed": if (!l.missed_calls) return false; break;
    case "dup": if (!l.dup) return false; break;
    case "won": case "lost": if (l.status !== f.quick) return false; break;
  }
  if (f.statuses.length && !f.statuses.includes(l.status)) return false;
  if (f.stages.length && !f.stages.includes(l.stage.id)) return false;
  if (f.managers.length && !f.managers.includes(l.manager?.id ?? 0)) return false;
  if (f.sources.length && !f.sources.includes(l.source?.name ?? "")) return false;
  if (f.tags.length && !f.tags.some((t) => l.tags.includes(t))) return false;
  if (!inRange(Number(l.budget), f.budget)) return false;
  if (f.task) {
    const tomorrow = dayjs().add(1, "day");
    if (f.task === "none" && (l.status !== "open" || l.open_tasks)) return false;
    if (f.task === "overdue" && !l.overdue) return false;
    if (f.task === "today" && (!due || due > today)) return false;
    if (f.task === "tomorrow" && (!due || !dayjs(due).isSame(tomorrow, "day"))) return false;
    if (f.task === "week" && (!due || due > dayjs().add(7, "day").valueOf())) return false;
  }
  for (const fd of fields) {
    const want = f.custom[fd.key];
    if (want === undefined || want === "" || (Array.isArray(want) && !want.length)) continue;
    const v = l.values[fd.key];
    if (fd.type === "select" && Array.isArray(want) && !want.includes(String(v ?? ""))) return false;
    if (fd.type === "number" && typeof want === "object" && !Array.isArray(want) && (v === null || v === undefined || !inRange(Number(v), want))) return false;
    if (fd.type === "date" && typeof want === "object" && !Array.isArray(want)) {
      const s = String(v ?? "");
      if (!s || (want.min && s < want.min) || (want.max && s > want.max)) return false;
    }
    if (fd.type === "bool" && typeof want === "string" && (want === "yes") !== (v === true)) return false;
    if (["text", "phone", "url"].includes(fd.type) && typeof want === "string" && !String(v ?? "").toLowerCase().includes(want.toLowerCase())) return false;
  }
  if (f.q.trim()) {
    const hay = [l.title, l.client?.name, l.contact_name, l.phone.replace(/\D+/g, ""), l.tags.join(" "), l.source?.name,
      l.code, ...Object.values(l.values).map((x) => String(x ?? ""))].join(" ").toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w.replace(/[+\s]/g, "")))) return false;
  }
  return true;
}

function activeCount(f: Filter): number {
  return [f.statuses.length, f.stages.length, f.managers.length, f.task, f.sources.length, f.tags.length, f.period,
    f.budget.min || f.budget.max, ...Object.values(f.custom).map((v) => (Array.isArray(v) ? v.length : typeof v === "string" ? v : v.min || v.max))]
    .filter(Boolean).length;
}

// ------------------------------------------------------------------ presets (this browser only)

type Preset = { name: string; f: Filter };
const presetKey = (userId: number | null) => `crm.filters.${userId ?? 0}`;
function readPresets(userId: number | null): Preset[] {
  try { return JSON.parse(localStorage.getItem(presetKey(userId)) || "[]"); } catch { return []; }
}
function writePresets(userId: number | null, list: Preset[]) {
  try { localStorage.setItem(presetKey(userId), JSON.stringify(list)); } catch { /* private mode */ }
}

// ------------------------------------------------------------------ UI

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent-soft font-semibold text-accent-ink" : "border-line text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function FilterBar({ value: f, onChange, cards, stages, managers, fields, meId, count, phoneOn, dupOn }: {
  value: Filter; onChange: (f: Filter) => void; cards: LeadCard[]; stages: Stage[]; managers: { id: number; name: string }[];
  fields: LeadField[]; meId: number | null; count: number; phoneOn: boolean; dupOn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(() => readPresets(meId));
  const [saving, setSaving] = useState("");
  const sources = useMemo(() => [...new Set(cards.map((c) => c.source?.name).filter(Boolean) as string[])].sort(), [cards]);
  const tags = useMemo(() => [...new Set(cards.flatMap((c) => c.tags))].sort(), [cards]);
  const set = (p: Partial<Filter>) => onChange({ ...f, ...p });
  const n = activeCount(f);
  const quick = QUICK.filter(([k]) => (k !== "missed" || phoneOn) && (k !== "dup" || dupOn));

  const savePreset = () => {
    const name = saving.trim();
    if (!name) return;
    const { q: _q, ...rest } = f;
    void _q;
    const list = [...presets.filter((p) => p.name !== name), { name, f: { ...rest, q: "" } }];
    setPresets(list); writePresets(meId, list); setSaving("");
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {quick.map(([k, label]) => <Chip key={k} on={f.quick === k} onClick={() => onChange({ ...EMPTY, q: f.q, quick: k })}>{label}</Chip>)}
        <Button variant={n ? "soft" : "ghost"} size="sm" onClick={() => setOpen((o) => !o)}>
          <FilterIcon className="size-3.5" strokeWidth={1.75} /> Filtr{n ? ` · ${n}` : ""}
        </Button>
        {presets.map((p) => (
          <span key={p.name} className="inline-flex items-center rounded-full border border-line text-xs">
            <button type="button" className="py-1 pl-2.5 pr-1 hover:text-accent-ink" onClick={() => onChange({ ...p.f, q: f.q })}>
              <Bookmark className="mr-1 inline size-3" />{p.name}
            </button>
            <button type="button" aria-label="O'chirish" className="pr-2 text-muted hover:text-bad"
              onClick={() => { const list = presets.filter((x) => x.name !== p.name); setPresets(list); writePresets(meId, list); }}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        {(n > 0 || f.quick) && <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => onChange({ ...EMPTY, q: f.q })}>Tozalash</button>}
      </div>
      {open && (
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-3 text-sm shadow-[var(--shadow-card)] md:grid-cols-2 xl:grid-cols-3">
          <Section title="Holat">
            {(["open", "won", "lost"] as LeadStatus[]).map((s) => (
              <Chip key={s} on={f.statuses.includes(s)} onClick={() => set({ statuses: toggle(f.statuses, s) })}>
                {{ open: "Ochiq", won: "Yutilgan", lost: "Rad etilgan" }[s]}
              </Chip>
            ))}
          </Section>
          <Section title="Bosqich">
            {stages.map((s) => <Chip key={s.id} on={f.stages.includes(s.id)} onClick={() => set({ stages: toggle(f.stages, s.id) })}>{s.name}</Chip>)}
          </Section>
          <Section title="Menejer">
            <Chip on={f.managers.includes(0)} onClick={() => set({ managers: toggle(f.managers, 0) })}>Biriktirilmagan</Chip>
            {managers.map((m) => <Chip key={m.id} on={f.managers.includes(m.id)} onClick={() => set({ managers: toggle(f.managers, m.id) })}>{m.name}</Chip>)}
          </Section>
          <Section title="Vazifa">
            {TASKS.map(([k, l]) => <Chip key={k} on={f.task === k} onClick={() => set({ task: f.task === k ? "" : k })}>{l}</Chip>)}
          </Section>
          <Section title="Kelgan sana">
            {PERIODS.map(([k, l]) => <Chip key={k} on={f.period === k} onClick={() => set({ period: f.period === k ? "" : k })}>{l}</Chip>)}
            {f.period === "custom" && (
              <span className="flex w-full gap-2">
                <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} />
                <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} />
              </span>
            )}
          </Section>
          <Section title="Byudjet (so'm)">
            <span className="flex w-full gap-2">
              <Input inputMode="numeric" placeholder="dan" value={f.budget.min ?? ""} onChange={(e) => set({ budget: { ...f.budget, min: e.target.value.replace(/\D/g, "") } })} />
              <Input inputMode="numeric" placeholder="gacha" value={f.budget.max ?? ""} onChange={(e) => set({ budget: { ...f.budget, max: e.target.value.replace(/\D/g, "") } })} />
            </span>
          </Section>
          {sources.length > 0 && (
            <Section title="Manba">
              {sources.map((s) => <Chip key={s} on={f.sources.includes(s)} onClick={() => set({ sources: toggle(f.sources, s) })}>{s}</Chip>)}
            </Section>
          )}
          {tags.length > 0 && (
            <Section title="Teglar">
              {tags.map((t) => <Chip key={t} on={f.tags.includes(t)} onClick={() => set({ tags: toggle(f.tags, t) })}>{t}</Chip>)}
            </Section>
          )}
          {fields.map((fd) => <CustomFilter key={fd.key} field={fd} f={f} set={set} cards={cards} />)}
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3">
            <Input placeholder="Filtrni saqlash: nomi" value={saving} onChange={(e) => setSaving(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); savePreset(); } }} className="max-w-xs" />
            <Button variant="ghost" size="sm" disabled={!saving.trim()} onClick={savePreset}><Bookmark className="size-3.5" /> Saqlash</Button>
            <span className="ml-auto text-xs text-muted">Ko'rsatilmoqda: <b className="text-ink">{count}</b></span>
            <Button size="sm" onClick={() => setOpen(false)}>Ko'rsatish</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <p className="t-label">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function CustomFilter({ field: fd, f, set, cards }: { field: LeadField; f: Filter; set: (p: Partial<Filter>) => void; cards: LeadCard[] }) {
  const want = f.custom[fd.key];
  const put = (v: string[] | Range | string) => set({ custom: { ...f.custom, [fd.key]: v } });
  if (fd.type === "select") {
    const list = Array.isArray(want) ? want : [];
    return <Section title={fd.label}>{fd.options.map((o) => <Chip key={o} on={list.includes(o)} onClick={() => put(toggle(list, o))}>{o}</Chip>)}</Section>;
  }
  if (fd.type === "bool") {
    const v = typeof want === "string" ? want : "";
    return <Section title={fd.label}>{([["", "Barchasi"], ["yes", "Ha"], ["no", "Yo'q"]] as const).map(([k, l]) => <Chip key={k} on={v === k} onClick={() => put(k)}>{l}</Chip>)}</Section>;
  }
  if (fd.type === "number" || fd.type === "date") {
    const r = (typeof want === "object" && !Array.isArray(want) ? want : {}) as Range;
    const type = fd.type === "date" ? "date" : "text";
    return (
      <Section title={fd.label}>
        <span className="flex w-full gap-2">
          <Input type={type} placeholder="dan" value={r.min ?? ""} onChange={(e) => put({ ...r, min: e.target.value })} />
          <Input type={type} placeholder="gacha" value={r.max ?? ""} onChange={(e) => put({ ...r, max: e.target.value })} />
        </span>
      </Section>
    );
  }
  const examples = [...new Set(cards.map((c) => fieldText(fd, c.values[fd.key] as FieldValue)).filter(Boolean))].slice(0, 3);
  return (
    <Section title={fd.label}>
      <Input placeholder={examples.join(", ") || "qidirish"} value={typeof want === "string" ? want : ""} onChange={(e) => put(e.target.value)} />
    </Section>
  );
}

export function ActiveChips({ f, onChange, stages }: { f: Filter; onChange: (f: Filter) => void; stages: Stage[] }) {
  const chips: [string, () => void][] = [];
  f.stages.forEach((id) => chips.push([stages.find((s) => s.id === id)?.name ?? "#", () => onChange({ ...f, stages: f.stages.filter((x) => x !== id) })]));
  f.tags.forEach((t) => chips.push([`#${t}`, () => onChange({ ...f, tags: f.tags.filter((x) => x !== t) })]));
  f.sources.forEach((s) => chips.push([s, () => onChange({ ...f, sources: f.sources.filter((x) => x !== s) })]));
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(([label, drop]) => (
        <button key={label} type="button" onClick={drop}><Pill tone="accent">{label} <X className="ml-1 size-3" /></Pill></button>
      ))}
    </div>
  );
}
