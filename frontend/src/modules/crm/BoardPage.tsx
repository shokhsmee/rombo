// Voronka: Kanban (drag a card to another stage) and a list with bulk actions; quick views and filters,
// configurable cards, quick edit. Ported from uzbridge crm/Board.tsx.
import dayjs from "dayjs";
import { AlarmClock, BarChart3, Columns3, Copy, LayoutTemplate, List, Pencil, Phone, PhoneMissed, Plus, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { SearchInput } from "@/components/SearchInput";
import { Button, Checkbox, ConfirmDialog, Dialog, Input, Pill, Select, Spinner } from "@/components/ui";
import { fmtMoney, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { dial } from "@/modules/telephony/live";

import {
  LEAD_STATUS, TONE_DOT, compact, fieldText, leadsApi, tagTone, useBoard, useBulk, useCrmSettings, useDuplicateCheck, useFields,
  useMoveLead, usePipelines, type Board, type LeadCard, type LeadField, type Pipeline, type Stage,
} from "./api";
import { CardSetup, QuickEdit } from "./cards";
import { ActiveChips, EMPTY, FilterBar, matches, serverParams, type Filter } from "./filters";

type View = "board" | "list";
const STALE_MS = 3 * 86_400_000;

function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { return (JSON.parse(localStorage.getItem(key) || "null") as T) ?? initial; } catch { return initial; } });
  return [v, (x: T) => { setV(x); try { localStorage.setItem(key, JSON.stringify(x)); } catch { /* private mode */ } }];
}

export function BoardPage() {
  const can = useCan("crm");
  const phoneOn = useCan("telephony").view;
  const navigate = useNavigate();
  const pipelines = usePipelines();
  const settings = useCrmSettings();
  const fieldsQ = useFields();
  const fields = (fieldsQ.data ?? []).filter((f) => f.active);
  const [view, setView] = useStored<View>("crm.view", "board");
  const [pipelineId, setPipelineId] = useState<number | null>(null);
  const [f, setF] = useState<Filter>(EMPTY);
  const [setup, setSetup] = useState(false);
  const [quick, setQuick] = useState<LeadCard | null>(null);
  const board = useBoard({ pipeline: pipelineId, ...serverParams(f) });
  const stages = board.data?.stages ?? [];
  const all = stages.flatMap((s) => s.leads);
  const visible = useMemo(() => stages.map((s) => ({ ...s, leads: s.leads.filter((l) => matches(l, f, settings.data?.me_employee ?? null, fields)) })),
    [stages, f, settings.data?.me_employee, fields]);
  const shown = visible.flatMap((s) => s.leads);
  const open = shown.filter((l) => l.status === "open");
  const managers = useMemo(() => {
    const m = new Map<number, string>();
    all.forEach((l) => l.manager && m.set(l.manager.id, l.manager.name));
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);
  const active = (pipelines.data ?? []).filter((p) => p.is_active);
  const current = active.find((p) => p.id === (pipelineId ?? board.data?.pipeline.id));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="t-title mr-1">Voronka</h1>
        {active.length > 1 && (
          <div className="flex gap-0.5 rounded-lg bg-sunk p-0.5">
            {active.map((p) => (
              <button key={p.id} type="button" onClick={() => setPipelineId(p.id)}
                className={`rounded-md px-3 py-1 text-sm ${current?.id === p.id ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-ink"}`}>{p.name}</button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <SearchInput value={f.q} onChange={(q) => setF({ ...f, q })} placeholder="Nom, telefon, teg…" />
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {([["board", Columns3, "Kanban"], ["list", List, "Ro'yxat"]] as const).map(([v, Icon, t]) => (
              <button key={v} type="button" title={t} aria-label={t} onClick={() => setView(v)}
                className={`grid h-7 w-8 place-items-center rounded-md ${view === v ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>
                <Icon className="size-4" strokeWidth={1.75} />
              </button>
            ))}
          </div>
          {can.update && view === "board" && <Button variant="ghost" title="Kartochka ko'rinishi" onClick={() => setSetup(true)}><LayoutTemplate className="size-4" strokeWidth={1.75} /></Button>}
          <Link to="/crm/analytics" title="Analitika"><Button variant="ghost"><BarChart3 className="size-4" strokeWidth={1.75} /></Button></Link>
          {can.update && <Link to="/crm/settings" title="Sozlamalar"><Button variant="ghost"><Settings2 className="size-4" strokeWidth={1.75} /></Button></Link>}
          {can.create && <Button onClick={() => navigate("/crm/leads/new")}><Plus className="size-4" /> Yangi lid</Button>}
        </div>
      </div>
      <FilterBar value={f} onChange={setF} cards={all} stages={stages} managers={managers} fields={fields}
        meId={settings.data?.me_employee ?? null} count={shown.length} phoneOn={phoneOn} dupOn={!!settings.data?.duplicates_enabled} />
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span><b className="tabular text-ink">{shown.length}</b> ta lid · <span className="tabular">{fmtMoney(shown.reduce((a, l) => a + Number(l.budget), 0), "UZS")}</span></span>
        <span>ochiq <b className="tabular text-ink">{open.length}</b></span>
        <ActiveChips f={f} onChange={setF} stages={stages} />
      </div>

      {board.isLoading ? <div className="grid h-40 place-items-center text-muted"><Spinner className="size-5" /></div>
        : board.data && (view === "board"
          ? <Kanban board={{ ...board.data, stages: visible }} pipeline={current} edit={can.update} create={can.create} phoneOn={phoneOn}
              cardFields={settings.data?.card_fields ?? []} fields={fields} autoOn={!!settings.data?.distribution_enabled} onQuick={setQuick} />
          : <LeadList stages={visible} pipeline={current} edit={can.update} canDelete={can.delete} />)}
      {setup && <CardSetup fields={fields} onClose={() => setSetup(false)} />}
      {quick && <QuickEdit lead={quick} stages={stages} fields={fields} onClose={() => setQuick(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ kanban */

function Kanban({ board, pipeline, edit, create, phoneOn, cardFields, fields, autoOn, onQuick }: {
  board: Board; pipeline?: Pipeline; edit: boolean; create: boolean; phoneOn: boolean; cardFields: string[]; fields: LeadField[];
  autoOn: boolean; onQuick: (l: LeadCard) => void;
}) {
  const navigate = useNavigate();
  const move = useMoveLead();
  const save = leadsApi.useSave();
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [lost, setLost] = useState<{ lead: number; stage: Stage } | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  const drop = (stage: Stage) => {
    const id = drag;
    setDrag(null); setOver(null);
    if (id == null || board.stages.find((s) => s.id === stage.id)?.leads.some((l) => l.id === id)) return;
    if (stage.is_lost) return setLost({ lead: id, stage });
    move.mutate({ id, stage_id: stage.id }, { onSuccess: () => notifyOk(`Bosqich: ${stage.name}`), onError: notifyError });
  };

  return (
    <div className="-mx-4 flex min-h-[60vh] gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
      {board.stages.map((st) => {
        const terminal = st.is_won || st.is_lost;
        const sum = st.leads.reduce((a, l) => a + Number(l.budget), 0);
        return (
          <div key={st.id}
            onDragOver={(e) => { if (edit && drag != null) { e.preventDefault(); setOver(st.id); } }}
            onDragLeave={() => setOver((s) => (s === st.id ? null : s))}
            onDrop={() => drop(st)}
            className={`flex shrink-0 flex-col rounded-xl border bg-sunk/50 ${terminal ? "w-64" : "w-72"} ${over === st.id ? "border-accent ring-2 ring-accent/30" : "border-line"}`}>
            <div className="border-b border-line px-3 pb-2 pt-2.5">
              <div className="flex items-center gap-2">
                <span className={`size-2.5 shrink-0 rounded-full ${TONE_DOT[st.tone]}`} />
                <span className="truncate text-[13px] font-semibold" title={st.hint}>{st.name}</span>
                <span className="rounded-full bg-surface px-2 text-xs font-semibold tabular text-muted">{st.leads.length}</span>
                {create && !terminal && (
                  <button type="button" onClick={() => setAdding(st.id)} title="Lid qo'shish"
                    className="ml-auto grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-accent-ink">
                    <Plus className="size-4" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-xs tabular text-muted">{compact(sum)} so'm</p>
              {st.hint && <p className="line-clamp-1 text-2xs text-faint" title={st.hint}>{st.hint}</p>}
            </div>
            <div className="grid content-start gap-2 p-2">
              {adding === st.id && (
                <QuickAdd busy={save.isPending} autoOn={autoOn} onCancel={() => setAdding(null)}
                  onSubmit={(data) => save.mutate({ data: { ...data, stage_id: st.id } }, { onSuccess: () => setAdding(null), onError: notifyError })} />
              )}
              {st.leads.map((l) => (
                <Tile key={l.id} lead={l} edit={edit} phoneOn={phoneOn} terminal={terminal} show={cardFields} fields={fields}
                  dragging={drag === l.id} onDragStart={() => setDrag(l.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                  onOpen={() => navigate(`/crm/leads/${l.id}`)} onQuick={() => onQuick(l)} />
              ))}
              {!st.leads.length && adding !== st.id && (
                <p className="rounded-lg border border-dashed border-line py-8 text-center text-xs text-muted">{drag != null ? "shu yerga tashlang" : "bo'sh"}</p>
              )}
            </div>
          </div>
        );
      })}
      <LostDialog open={!!lost} busy={move.isPending} reasons={pipeline?.lost_reasons.map((r) => r.text)} onClose={() => setLost(null)}
        onConfirm={(reason) => lost && move.mutate({ id: lost.lead, stage_id: lost.stage.id, lost_reason: reason }, {
          onSuccess: () => { setLost(null); notifyOk("Rad etildi"); }, onError: notifyError,
        })} />
    </div>
  );
}

function Tile({ lead, edit, phoneOn, terminal, show, fields, dragging, onDragStart, onDragEnd, onOpen, onQuick }: {
  lead: LeadCard; edit: boolean; phoneOn: boolean; terminal: boolean; show: string[]; fields: LeadField[]; dragging: boolean;
  onDragStart: () => void; onDragEnd: () => void; onOpen: () => void; onQuick: () => void;
}) {
  const has = (k: string) => show.includes(k);
  const who = lead.client?.name ?? lead.contact_name;
  const extra = show.filter((k) => k.startsWith("f:")).map((k) => fields.find((x) => x.key === k.slice(2))).filter((x): x is LeadField => !!x);
  const stale = !terminal && Date.now() - new Date(lead.last_activity_at ?? lead.created_at).getTime() > STALE_MS;
  return (
    <div draggable={edit} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      className={`group cursor-pointer rounded-lg border bg-surface p-3 shadow-[var(--shadow-card)] transition hover:border-accent/60 ${dragging ? "opacity-40" : ""} ${lead.overdue ? "border-bad/40" : "border-line"}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{lead.title}</p>
          {has("customer") && who && who !== lead.title && <p className="truncate text-xs text-muted">{who}</p>}
          {has("phone") && lead.phone && !lead.title.includes(lead.phone) && <p className="text-xs tabular text-muted">{lead.phone}</p>}
        </div>
        <span className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          {edit && (
            <button type="button" title="Tez tahrirlash" aria-label="Tez tahrirlash" onClick={(e) => { e.stopPropagation(); onQuick(); }}
              className="grid size-7 place-items-center rounded-full bg-sunk text-muted hover:text-accent-ink"><Pencil className="size-3.5" strokeWidth={1.75} /></button>
          )}
          {phoneOn && lead.phone && (
            <button type="button" title="Qo'ng'iroq qilish" aria-label="Qo'ng'iroq qilish" onClick={(e) => { e.stopPropagation(); dial(lead.phone); }}
              className="grid size-7 place-items-center rounded-full bg-ok-soft text-ok"><Phone className="size-3.5" strokeWidth={1.75} /></button>
          )}
        </span>
      </div>
      {(lead.dup || lead.missed_calls > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {lead.dup && <Pill tone="warn"><Copy className="mr-1 size-3" />Dubl</Pill>}
          {lead.missed_calls > 0 && <Pill tone="bad"><PhoneMissed className="mr-1 size-3" />{lead.missed_calls}</Pill>}
        </div>
      )}
      {has("tags") && lead.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">{lead.tags.map((t) => <Pill key={t} tone={tagTone(t)}>{t}</Pill>)}</div>
      )}
      {extra.length > 0 && (
        <dl className="mt-2 grid gap-0.5 rounded-md bg-ground/70 px-2 py-1 text-xs">
          {extra.map((fd) => (
            <div key={fd.key} className="flex items-baseline justify-between gap-2">
              <dt className="shrink-0 text-muted">{fd.label}</dt>
              <dd className="min-w-0 truncate text-right font-medium">{fieldText(fd, lead.values[fd.key]) || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {has("budget") && Number(lead.budget) > 0 && <span className="font-semibold tabular">{compact(Number(lead.budget))} so'm</span>}
        {has("manager") && lead.manager && <span className="text-muted">{lead.manager.name}</span>}
        {has("source") && lead.source && <span className="text-faint">{lead.source.name}</span>}
        {has("days") && !terminal && <span className={lead.days_in_stage > 7 ? "text-warn" : "text-faint"}>{lead.days_in_stage} kun</span>}
        {has("created") && <span className="text-faint">{dayjs(lead.created_at).format("DD.MM")}</span>}
      </div>
      {has("task") && !terminal && (lead.next_task_kind
        ? <p className={`mt-2 flex items-center gap-1 text-xs ${lead.overdue ? "font-semibold text-bad" : "text-muted"}`}>
            <AlarmClock className="size-3.5" strokeWidth={1.75} />
            {lead.next_task_text || lead.next_task_kind}{lead.next_task_due && <> · {dayjs(lead.next_task_due).format("DD.MM HH:mm")}</>}
          </p>
        : lead.status === "open" && <p className="mt-2 text-xs text-warn">Vazifa yo'q</p>)}
      {has("activity") && lead.last_activity && (
        <p className={`mt-1 line-clamp-1 text-2xs ${stale ? "text-warn" : "text-faint"}`}>{lead.last_activity} · {dayjs(lead.last_activity_at).format("DD.MM HH:mm")}</p>
      )}
      {lead.status === "lost" && lead.lost_reason && <p className="mt-1 text-xs text-bad">{lead.lost_reason}</p>}
      {lead.project && <p className="mt-1 text-xs font-medium text-ok">{lead.project.code}</p>}
    </div>
  );
}

function QuickAdd({ busy, autoOn, onSubmit, onCancel }: {
  busy: boolean; autoOn: boolean; onSubmit: (d: Record<string, unknown>) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState("");
  const [auto, setAuto] = useState(autoOn);
  const dups = useDuplicateCheck(phone);
  return (
    <form className="grid gap-2 rounded-lg border border-accent bg-surface p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() || phone.trim() || contact.trim()) onSubmit({ title, phone, contact_name: contact, budget: String(toNum(budget || "0")), auto_manager: auto });
      }}>
      <Input autoFocus placeholder="Nima kerak? (masalan: 3 xona derazalari)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Ism" value={contact} onChange={(e) => setContact(e.target.value)} />
      <Input placeholder="+998 __ ___ __ __" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {!!dups.data?.length && (
        <p className="rounded-md bg-warn-soft px-2 py-1 text-xs text-warn">
          Bu raqamda ochiq lid bor: {dups.data.slice(0, 2).map((d) => <Link key={d.id} to={`/crm/leads/${d.id}`} className="font-semibold underline">{d.code}</Link>).reduce((a, b) => <>{a}, {b}</>)}
        </p>
      )}
      <Input placeholder="Byudjet" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
      {autoOn && <label className="flex items-center gap-2 text-xs text-muted"><Checkbox label="Taqsimlash" checked={auto} onChange={setAuto} /> Mas'ulni taqsimlash tanlasin</label>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Bekor</Button>
        <Button size="sm" type="submit" busy={busy}>Qo'shish</Button>
      </div>
    </form>
  );
}

export function LostDialog({ open, busy, reasons, onClose, onConfirm }: {
  open: boolean; busy: boolean; reasons?: string[]; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Rad etish sababi"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Rad etish</Button>
      </>}>
      <div className="flex flex-wrap gap-1.5">
        {(reasons ?? []).map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)}
            className={`rounded-full border px-3 py-1 text-xs ${reason === r ? "border-bad bg-bad-soft text-bad" : "border-line text-muted hover:text-ink"}`}>{r}</button>
        ))}
      </div>
      <Input placeholder="Boshqa sabab…" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ list + bulk */

type SortKey = "title" | "budget" | "stage" | "activity" | "created" | "task";

function LeadList({ stages, pipeline, edit, canDelete }: { stages: (Stage & { leads: LeadCard[] })[]; pipeline?: Pipeline; edit: boolean; canDelete: boolean }) {
  const navigate = useNavigate();
  const bulk = useBulk();
  const move = useMoveLead();
  const [sel, setSel] = useState<number[]>([]);
  const [sort, setSort] = useState<[SortKey, 1 | -1]>(["created", -1]);
  const [ask, setAsk] = useState<"" | "tag" | "lost" | "delete">("");
  const [text, setText] = useState("");
  const pos = new Map(stages.map((s, i) => [s.id, i]));
  const rows = stages.flatMap((s) => s.leads).sort((a, b) => {
    const v = (l: LeadCard): number | string => ({
      title: l.title.toLowerCase(), budget: Number(l.budget), stage: pos.get(l.stage.id) ?? 0,
      activity: l.last_activity_at ?? l.created_at, created: l.created_at, task: l.next_task_due ?? "9",
    })[sort[0]];
    return (v(a) > v(b) ? 1 : v(a) < v(b) ? -1 : 0) * sort[1];
  });
  const run = (body: Parameters<typeof bulk.mutate>[0]) =>
    bulk.mutate(body, { onSuccess: (r) => { notifyOk(`${r.updated} ta lid`); setSel([]); setAsk(""); setText(""); }, onError: notifyError });
  const th = (k: SortKey, label: string, cls = "") => (
    <th className={`px-3 py-2 font-medium ${cls}`}>
      <button type="button" className="hover:text-ink" onClick={() => setSort([k, sort[0] === k ? (-sort[1] as 1 | -1) : 1])}>{label}{sort[0] === k ? (sort[1] > 0 ? " ↑" : " ↓") : ""}</button>
    </th>
  );
  return (
    <div className="grid gap-2">
      {edit && sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent bg-accent-soft/40 px-3 py-2 text-sm">
          <b>{sel.length} ta tanlandi</b>
          <Select className="w-44" value="" onChange={(e) => e.target.value && run({ ids: sel, action: "move", stage_id: Number(e.target.value) })}>
            <option value="">Bosqichga…</option>
            {stages.filter((s) => !s.is_lost).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <EntitySelect endpoint="employees" placeholder="Menejerga…" className="w-48" extraParams={{ status: "active" }} value={null}
            onChange={(id) => id && run({ ids: sel, action: "assign", manager_id: id })} />
          <Button variant="ghost" size="sm" onClick={() => setAsk("tag")}>+ Teg</Button>
          <Button variant="ghost" size="sm" onClick={() => setAsk("lost")}>Rad etish</Button>
          {canDelete && <Button variant="danger" size="sm" onClick={() => setAsk("delete")}>O'chirish</Button>}
          <button type="button" className="ml-auto text-xs text-muted hover:text-ink" onClick={() => setSel([])}>Bekor</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              {edit && <th className="w-8 px-3 py-2"><Checkbox label="Hammasi" checked={!!rows.length && sel.length === rows.length} indeterminate={!!sel.length && sel.length < rows.length}
                onChange={(on) => setSel(on ? rows.map((r) => r.id) : [])} /></th>}
              {th("title", "Lid")}{th("stage", "Bosqich")}{th("budget", "Byudjet", "text-right")}
              <th className="px-3 py-2 font-medium">Menejer</th>{th("task", "Vazifa")}{th("activity", "Faollik")}{th("created", "Kelgan")}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} onClick={() => navigate(`/crm/leads/${l.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-ground">
                {edit && <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox label="Tanlash" checked={sel.includes(l.id)} onChange={(on) => setSel(on ? [...sel, l.id] : sel.filter((x) => x !== l.id))} />
                </td>}
                <td className="px-3 py-2">
                  <div className="min-w-48 font-medium">{l.title} {l.dup && <Pill tone="warn">Dubl</Pill>}</div>
                  <div className="text-xs text-muted">{l.code} · {l.client?.name ?? l.contact_name}{l.phone && <> · <span className="tabular">{l.phone}</span></>}</div>
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {edit && l.status === "open"
                    ? <Select className="w-36" value={l.stage.id} onChange={(e) => move.mutate({ id: l.id, stage_id: Number(e.target.value) }, { onError: notifyError })}>
                        {stages.filter((s) => !s.is_lost).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </Select>
                    : <Pill tone={l.stage.tone}>{l.stage.name}</Pill>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular">{fmtMoney(l.budget)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{l.manager?.name ?? <span className="text-muted">—</span>}</td>
                <td className={`whitespace-nowrap px-3 py-2 text-xs ${l.overdue ? "font-semibold text-bad" : "text-muted"}`}>
                  {l.next_task_due ? dayjs(l.next_task_due).format("DD.MM HH:mm") : l.status === "open" ? <span className="text-warn">yo'q</span> : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{l.last_activity_at ? dayjs(l.last_activity_at).format("DD.MM HH:mm") : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                  {dayjs(l.created_at).format("DD.MM.YYYY")} <Pill tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Pill>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">Lid topilmadi</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t border-line text-xs text-muted">
              <td colSpan={8} className="px-3 py-2">{rows.length} ta · {fmtMoney(rows.reduce((a, l) => a + Number(l.budget), 0), "UZS")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Dialog open={ask === "tag"} onClose={() => setAsk("")} title={`${sel.length} ta lidga teg`}
        footer={<Button disabled={!text.trim()} busy={bulk.isPending} onClick={() => run({ ids: sel, action: "tag", tag: text.trim() })}>Qo'shish</Button>}>
        <Input autoFocus placeholder="teg" value={text} onChange={(e) => setText(e.target.value)} />
      </Dialog>
      <LostDialog open={ask === "lost"} busy={bulk.isPending} reasons={pipeline?.lost_reasons.map((r) => r.text)} onClose={() => setAsk("")}
        onConfirm={(reason) => run({ ids: sel, action: "lost", reason })} />
      <ConfirmDialog open={ask === "delete"} onClose={() => setAsk("")} danger busy={bulk.isPending} title="O'chirishni tasdiqlang"
        text={`${sel.length} ta lid arxivga o'tkaziladi (loyiha ochilganlari qoladi).`} confirmLabel="O'chirish"
        onConfirm={() => run({ ids: sel, action: "delete" })} />
    </div>
  );
}
