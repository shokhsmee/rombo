// Voronka: Kanban (drag a card to another stage) and a list. Ported from uzbridge crm/Board.tsx.
import dayjs from "dayjs";
import { AlarmClock, Columns3, List, Phone, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Button, Dialog, Input, Pill, Select, Spinner } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtMoney } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { RefSelect } from "@/modules/references/RefSelect";
import { dial } from "@/modules/telephony/live";

import {
  LEAD_STATUS, LOST_REASONS, TASK_KIND, TONE_DOT, leadsApi, useBoard, useMoveLead, usePipelines,
  type Board, type LeadCard, type Stage,
} from "./api";
import { StagesDialog } from "./StagesDialog";

type View = "board" | "list";

const short = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 });

export function BoardPage() {
  const can = useCan("crm");
  const phoneOn = useCan("telephony").view;
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" });
  const f = params.filters;
  const view: View = f.view === "list" ? "list" : "board";
  const pipelines = usePipelines();
  const pipelineId = (f.pipeline as string) || "";
  const filters = { pipeline: pipelineId, q: params.q, manager: f.manager, source: f.source };
  const board = useBoard(filters);
  const list = leadsApi.useList({ ...query, view: undefined }, { enabled: view === "list" });
  const [stagesOpen, setStagesOpen] = useState(false);

  const stages = board.data?.stages ?? [];
  const cards = stages.flatMap((s) => s.leads);
  const open = cards.filter((l) => l.status === "open");

  return (
    <>
      <PageHeader title="Voronka" lede="Lidlar: murojaatdan shartnomagacha."
        action={can.create && (
          <Button onClick={() => navigate("/crm/leads/new")}><Plus className="size-4" /> Yangi lid</Button>
        )} />
      <Toolbar action={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {([["board", Columns3, "Kanban"], ["list", List, "Ro'yxat"]] as const).map(([v, Icon, t]) => (
              <button key={v} type="button" title={t} aria-label={t} onClick={() => update({ filters: { view: v === "list" ? "list" : null } })}
                className={`grid h-7 w-8 place-items-center rounded-md ${view === v ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>
                <Icon className="size-4" strokeWidth={1.75} />
              </button>
            ))}
          </div>
          {can.update && <Button variant="ghost" onClick={() => setStagesOpen(true)} title="Bosqichlar"><Settings2 className="size-4" strokeWidth={1.75} /></Button>}
        </div>
      }>
        {(pipelines.data?.length ?? 0) > 1 && (
          <Select className="w-44" value={pipelineId} onChange={(e) => update({ filters: { pipeline: e.target.value || null } })}>
            {pipelines.data!.map((p) => <option key={p.id} value={p.is_default ? "" : p.id}>{p.name}</option>)}
          </Select>
        )}
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Nom, telefon, mijoz…" />
        <EntitySelect endpoint="employees" placeholder="Menejer" className="w-48" extraParams={{ status: "active" }}
          value={f.manager ? Number(f.manager) : null}
          onChange={(id) => update({ filters: { manager: id ? String(id) : null } })} />
        <RefSelect kind="sales_channel" className="w-44" placeholder="Manba: barchasi"
          value={f.source ? Number(f.source) : null} onChange={(id) => update({ filters: { source: id ? String(id) : null } })} />
      </Toolbar>

      {view === "board" && (
        <>
          <p className="text-xs text-muted">
            <b className="text-ink tabular">{cards.length}</b> ta lid · ochiq <b className="text-ink tabular">{open.length}</b> ·{" "}
            <span className="tabular">{fmtMoney(open.reduce((a, l) => a + Number(l.budget), 0), "UZS")}</span>
          </p>
          {board.isLoading ? <div className="grid h-40 place-items-center text-muted"><Spinner className="size-5" /></div>
            : board.data && <Kanban board={board.data} edit={can.update} create={can.create} phoneOn={phoneOn} />}
        </>
      )}
      {view === "list" && (
        <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
          navKey="crm" onRowClick={(r) => navigate(`/crm/leads/${r.id}`)} />
      )}
      {stagesOpen && pipelines.data && (
        <StagesDialog pipeline={pipelines.data.find((p) => String(p.id) === pipelineId) ?? pipelines.data.find((p) => p.is_default) ?? pipelines.data[0]}
          onClose={() => setStagesOpen(false)} />
      )}
    </>
  );
}

const columns: Column<LeadCard>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "title", title: "Lid", sort: "title",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.title}</div>
        <div className="text-xs text-muted">{r.client?.name ?? r.contact_name}{r.phone && <> · <span className="tabular">{r.phone}</span></>}</div>
      </div>
    ) },
  { key: "stage", title: "Bosqich", render: (r) => <Pill tone={r.stage.tone}>{r.stage.name}</Pill> },
  { key: "budget", title: "Byudjet", sort: "budget", align: "right", className: "whitespace-nowrap tabular", render: (r) => fmtMoney(r.budget) },
  { key: "manager", title: "Menejer", className: "whitespace-nowrap text-xs", render: (r) => r.manager?.name ?? <span className="text-muted">—</span> },
  { key: "source", title: "Manba", className: "whitespace-nowrap text-xs", render: (r) => r.source?.name ?? <span className="text-muted">—</span> },
  { key: "status", title: "Holat", render: (r) => <Pill tone={LEAD_STATUS[r.status].tone}>{LEAD_STATUS[r.status].label}</Pill> },
];

/* ------------------------------------------------------------------ kanban */

function Kanban({ board, edit, create, phoneOn }: { board: Board; edit: boolean; create: boolean; phoneOn: boolean }) {
  const navigate = useNavigate();
  const move = useMoveLead();
  const save = leadsApi.useSave();
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [lost, setLost] = useState<{ lead: number; stage: Stage } | null>(null);
  const [adding, setAdding] = useState(false);

  const drop = (stage: Stage) => {
    const id = drag;
    setDrag(null); setOver(null);
    if (id == null || board.stages.find((s) => s.id === stage.id)?.leads.some((l) => l.id === id)) return;
    if (stage.is_lost) return setLost({ lead: id, stage });
    move.mutate({ id, stage_id: stage.id }, { onSuccess: () => notifyOk(`Bosqich: ${stage.name}`), onError: notifyError });
  };
  const first = board.stages.find((s) => !s.is_won && !s.is_lost);

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
                <span className="truncate text-[13px] font-semibold">{st.name}</span>
                <span className="rounded-full bg-surface px-2 text-xs font-semibold tabular text-muted">{st.leads.length}</span>
                {create && first?.id === st.id && (
                  <button type="button" onClick={() => setAdding(true)} title="Lid qo'shish"
                    className="ml-auto grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-accent-ink">
                    <Plus className="size-4" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-xs tabular text-muted">{short.format(sum)} so'm</p>
            </div>
            <div className="grid content-start gap-2 p-2">
              {adding && first?.id === st.id && (
                <QuickAdd busy={save.isPending} onCancel={() => setAdding(false)}
                  onSubmit={(data) => save.mutate({ data: { ...data, stage_id: st.id } }, { onSuccess: () => setAdding(false), onError: notifyError })} />
              )}
              {st.leads.map((l) => (
                <Tile key={l.id} lead={l} edit={edit} phoneOn={phoneOn} dragging={drag === l.id}
                  onDragStart={() => setDrag(l.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                  onOpen={() => navigate(`/crm/leads/${l.id}`)} />
              ))}
              {!st.leads.length && !(adding && first?.id === st.id) && (
                <p className="rounded-lg border border-dashed border-line py-8 text-center text-xs text-muted">{drag != null ? "shu yerga tashlang" : "bo'sh"}</p>
              )}
            </div>
          </div>
        );
      })}
      <LostDialog open={!!lost} busy={move.isPending} onClose={() => setLost(null)}
        onConfirm={(reason) => lost && move.mutate({ id: lost.lead, stage_id: lost.stage.id, lost_reason: reason }, {
          onSuccess: () => { setLost(null); notifyOk("Rad etildi"); }, onError: notifyError,
        })} />
    </div>
  );
}

function Tile({ lead, edit, phoneOn, dragging, onDragStart, onDragEnd, onOpen }: {
  lead: LeadCard; edit: boolean; phoneOn: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onOpen: () => void;
}) {
  const who = lead.client?.name ?? lead.contact_name;
  return (
    <div draggable={edit} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      className={`group cursor-pointer rounded-lg border bg-surface p-3 shadow-[var(--shadow-card)] transition hover:border-accent/60 ${dragging ? "opacity-40" : ""} ${lead.overdue ? "border-bad/40" : "border-line"}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{lead.title}</p>
          {who && who !== lead.title && <p className="truncate text-xs text-muted">{who}</p>}
          {lead.phone && !lead.title.includes(lead.phone) && <p className="text-xs tabular text-muted">{lead.phone}</p>}
        </div>
        {phoneOn && lead.phone && (
          <button type="button" title="Qo'ng'iroq qilish" aria-label="Qo'ng'iroq qilish"
            onClick={(e) => { e.stopPropagation(); dial(lead.phone); }}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-ok-soft text-ok opacity-0 transition group-hover:opacity-100">
            <Phone className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {Number(lead.budget) > 0 && <span className="font-semibold tabular">{short.format(Number(lead.budget))} so'm</span>}
        {lead.manager && <span className="text-muted">{lead.manager.name}</span>}
        {lead.source && <span className="text-faint">{lead.source.name}</span>}
      </div>
      {lead.next_task_kind && (
        <p className={`mt-2 flex items-center gap-1 text-xs ${lead.overdue ? "font-semibold text-bad" : "text-muted"}`}>
          <AlarmClock className="size-3.5" strokeWidth={1.75} />
          {TASK_KIND[lead.next_task_kind]}{lead.next_task_due && <> · {dayjs(lead.next_task_due).format("DD.MM HH:mm")}</>}
        </p>
      )}
      {lead.status === "lost" && lead.lost_reason && <p className="mt-1 text-xs text-bad">{lead.lost_reason}</p>}
      {lead.project && <p className="mt-1 text-xs font-medium text-ok">{lead.project.code}</p>}
    </div>
  );
}

function QuickAdd({ busy, onSubmit, onCancel }: { busy: boolean; onSubmit: (d: { title: string; phone: string; contact_name: string }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <form className="grid gap-2 rounded-lg border border-accent bg-surface p-2.5"
      onSubmit={(e) => { e.preventDefault(); if (title.trim() || phone.trim() || contact.trim()) onSubmit({ title, phone, contact_name: contact }); }}>
      <Input autoFocus placeholder="Nima kerak? (masalan: 3 xona derazalari)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Ism" value={contact} onChange={(e) => setContact(e.target.value)} />
      <Input placeholder="+998 __ ___ __ __" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Bekor</Button>
        <Button size="sm" type="submit" busy={busy}>Qo'shish</Button>
      </div>
    </form>
  );
}

export function LostDialog({ open, busy, onClose, onConfirm }: { open: boolean; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Rad etish sababi"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Rad etish</Button>
      </>}>
      <div className="flex flex-wrap gap-1.5">
        {LOST_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)}
            className={`rounded-full border px-3 py-1 text-xs ${reason === r ? "border-bad bg-bad-soft text-bad" : "border-line text-muted hover:text-ink"}`}>{r}</button>
        ))}
      </div>
      <Input placeholder="Yoki o'z sababingiz…" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Dialog>
  );
}
