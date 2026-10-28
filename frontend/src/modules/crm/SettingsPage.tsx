// CRM → Sozlamalar (ported from uzbridge crm/Settings.tsx): voronkas and their stages and lost reasons, the lead
// card's own fields, task types and add-ons, distribution, lead sources (website forms, Yuboraman, amoCRM).
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { Button, ConfirmDialog, IconButton, Input, Segmented, Select, Toggle, type Tone } from "@/components/ui";
import { api, type Page } from "@/lib/api";
import { notifyError, notifyOk } from "@/lib/notify";
import { ConnectionsPanel } from "@/modules/telephony/ConnectionsPanel";

import { FieldsSettings } from "./FieldsSettings";

import {
  TONE_DOT, useAddLostReason, useCrmSettings, useDeleteLostReason, useDeleteStage, useOrderStages, usePipelines,
  useSaveCrmSettings, useSavePipeline, useSaveStage, type Pipeline,
} from "./api";

const TABS = [["pipeline", "Voronka"], ["fields", "Lid maydonlari"], ["general", "Vazifalar va qo'shimchalar"],
  ["distribution", "Taqsimlash"], ["sources", "Lid manbalari"]] as const;
type Tab = (typeof TABS)[number][0];

export function CrmSettingsPage() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "pipeline";
  return (
    <div className="grid gap-4">
      <PageHeader title="CRM sozlamalari" lede="Voronka, lid kartochkasi, vazifalar, taqsimlash va lid manbalari." />
      <Segmented value={tab} onChange={(t) => setSp({ tab: t }, { replace: true })} options={TABS.map(([value, label]) => ({ value, label }))} />
      {tab === "pipeline" && <PipelinesSettings />}
      {tab === "fields" && <div className="card p-4"><FieldsSettings /></div>}
      {tab === "general" && <GeneralSettings />}
      {tab === "distribution" && <DistributionSettings />}
      {tab === "sources" && <ConnectionsPanel group="leads" />}
    </div>
  );
}

// ------------------------------------------------------------------ pipelines

const TONES: [Tone, string][] = [
  ["accent", "Ko'k"], ["info", "Moviy"], ["done", "Binafsha"], ["warn", "Sariq"], ["neutral", "Kulrang"], ["ok", "Yashil"], ["bad", "Qizil"],
];

function PipelinesSettings() {
  const pipelines = usePipelines();
  const savePipeline = useSavePipeline();
  const [id, setId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const list = pipelines.data ?? [];
  const p = list.find((x) => x.id === id) ?? list.find((x) => x.is_default) ?? list[0];
  if (!p) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="card grid content-start gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-56" value={p.id} onChange={(e) => setId(Number(e.target.value))}>
            {list.map((x) => <option key={x.id} value={x.id}>{x.name}{x.is_active ? "" : " (arxiv)"}{x.is_default ? " · asosiy" : ""}</option>)}
          </Select>
          <Input className="w-56" defaultValue={p.name} key={p.id}
            onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && savePipeline.mutate({ id: p.id, name: e.target.value.trim() }, { onError: notifyError })} />
          {!p.is_default && p.is_active && <Button variant="ghost" size="sm" onClick={() => savePipeline.mutate({ id: p.id, is_default: true }, { onError: notifyError })}>Asosiy qilish</Button>}
          <Button variant="ghost" size="sm" onClick={() => savePipeline.mutate({ id: p.id, is_active: !p.is_active }, { onError: notifyError })}>
            {p.is_active ? "Arxivlash" : "Arxivdan chiqarish"}
          </Button>
          <span className="ml-auto flex gap-2">
            <Input className="w-44" placeholder="Yangi voronka" value={name} onChange={(e) => setName(e.target.value)} />
            <Button variant="soft" disabled={!name.trim()} onClick={() => savePipeline.mutate({ name: name.trim() }, {
              onSuccess: (x) => { setName(""); setId((x as Pipeline).id); }, onError: notifyError })}><Plus className="size-4" /> Voronka</Button>
          </span>
        </div>
        <StagesEditor pipeline={p} />
      </div>
      <LostReasons pipeline={p} />
    </div>
  );
}

export function StagesEditor({ pipeline }: { pipeline: Pipeline }) {
  const save = useSaveStage();
  const remove = useDeleteStage();
  const order = useOrderStages();
  const [name, setName] = useState("");
  const [del, setDel] = useState<number | null>(null);
  const work = pipeline.stages.filter((s) => !s.is_won && !s.is_lost);
  const terminal = pipeline.stages.filter((s) => s.is_won || s.is_lost);
  const swap = (i: number, j: number) => {
    const ids = work.map((s) => s.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    order.mutate({ pipeline: pipeline.id, ids }, { onError: notifyError });
  };
  const row = (s: Pipeline["stages"][number], i: number) => (
    <div key={s.id} className="grid items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)_7rem_auto]">
      <span className={`size-3 rounded-full ${TONE_DOT[s.tone]}`} />
      <Input defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && save.mutate({ id: s.id, name: e.target.value.trim() }, { onError: notifyError })} />
      <Input defaultValue={s.hint} placeholder="Izoh (ustun ostida)" onBlur={(e) => e.target.value !== s.hint && save.mutate({ id: s.id, hint: e.target.value }, { onError: notifyError })} />
      <Select value={s.tone} onChange={(e) => save.mutate({ id: s.id, tone: e.target.value as Tone }, { onError: notifyError })}>
        {TONES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
      </Select>
      {i >= 0 ? (
        <span className="flex">
          <IconButton label="Yuqoriga" disabled={i === 0} onClick={() => swap(i, i - 1)}><ArrowUp className="size-4" /></IconButton>
          <IconButton label="Pastga" disabled={i === work.length - 1} onClick={() => swap(i, i + 1)}><ArrowDown className="size-4" /></IconButton>
          <IconButton label="O'chirish" onClick={() => setDel(s.id)}><Trash2 className="size-4 text-bad" /></IconButton>
        </span>
      ) : <span className="w-24 text-center text-2xs text-muted">{s.is_won ? "yutildi" : "rad etildi"}</span>}
    </div>
  );
  return (
    <div className="grid gap-2">
      <p className="t-label">Ish bosqichlari</p>
      {work.map((s, i) => row(s, i))}
      <div className="flex gap-2">
        <Input placeholder="+ yangi bosqich" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { e.preventDefault(); save.mutate({ pipeline_id: pipeline.id, name: name.trim(), tone: "neutral" }, { onSuccess: () => setName(""), onError: notifyError }); } }} />
        <Button variant="soft" disabled={!name.trim()} onClick={() => save.mutate({ pipeline_id: pipeline.id, name: name.trim(), tone: "neutral" }, { onSuccess: () => setName(""), onError: notifyError })}><Plus className="size-4" /></Button>
      </div>
      <p className="t-label mt-2">Tizim bosqichlari</p>
      {terminal.map((s) => row(s, -1))}
      <ConfirmDialog open={del !== null} onClose={() => setDel(null)} danger title="Bosqichni o'chirish" busy={remove.isPending}
        text="Bosqichda lidlar bo'lsa — o'chirilmaydi." confirmLabel="O'chirish"
        onConfirm={() => del && remove.mutate(del, { onSuccess: () => setDel(null), onError: notifyError })} />
    </div>
  );
}

function LostReasons({ pipeline }: { pipeline: Pipeline }) {
  const add = useAddLostReason();
  const remove = useDeleteLostReason();
  const [text, setText] = useState("");
  return (
    <div className="card grid content-start gap-2 p-4">
      <p className="t-h2">Rad etish sabablari</p>
      <div className="flex flex-wrap gap-1.5">
        {pipeline.lost_reasons.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs">
            {r.text}
            <button type="button" aria-label="O'chirish" onClick={() => remove.mutate(r.id, { onError: notifyError })} className="text-muted hover:text-bad"><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Yangi sabab" value={text} onChange={(e) => setText(e.target.value)} />
        <Button variant="soft" disabled={!text.trim()} onClick={() => add.mutate({ pipeline: pipeline.id, text: text.trim() }, { onSuccess: () => setText(""), onError: notifyError })}><Plus className="size-4" /></Button>
      </div>
      <p className="text-xs text-muted">Lidni rad etishda tanlanadi; boshqa sababni ham yozish mumkin.</p>
    </div>
  );
}

// ------------------------------------------------------------------ general

function GeneralSettings() {
  const settings = useCrmSettings();
  const save = useSaveCrmSettings();
  const [type, setType] = useState("");
  const s = settings.data;
  if (!s) return null;
  const put = (data: Parameters<typeof save.mutate>[0]) => save.mutate(data, { onError: notifyError });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card grid content-start gap-3 p-4">
        <p className="t-h2">Vazifa turlari</p>
        <div className="flex flex-wrap gap-1.5">
          {s.task_types.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-sm">
              {t}
              {s.task_types.length > 1 && <button type="button" aria-label="O'chirish" onClick={() => put({ task_types: s.task_types.filter((x) => x !== t) })} className="text-muted hover:text-bad"><X className="size-3" /></button>}
            </span>
          ))}
          <input value={type} onChange={(e) => setType(e.target.value)} placeholder="+ tur (Enter)"
            onKeyDown={(e) => { if (e.key === "Enter" && type.trim()) { put({ task_types: [...s.task_types, type.trim()] }); setType(""); } }}
            className="h-7 w-32 rounded-md border border-dashed border-line bg-transparent px-2 text-sm outline-none focus:border-accent" />
        </div>
        <p className="text-xs text-muted">Birinchisi — yangi vazifaning odatiy turi.</p>
      </div>
      <div className="card grid content-start gap-3 p-4">
        <p className="t-h2">Qo'shimchalar</p>
        <Toggle label="Dubllarni aniqlash (bir raqamda bir nechta ochiq lid)" checked={s.duplicates_enabled} onChange={(x) => put({ duplicates_enabled: x })} />
        <Toggle label="Mas'ulni avtomatik taqsimlash" checked={s.distribution_enabled} onChange={(x) => put({ distribution_enabled: x })} />
      </div>
    </div>
  );
}

function DistributionSettings() {
  const settings = useCrmSettings();
  const save = useSaveCrmSettings();
  const can = useCan("employees");
  const emps = useQuery({
    queryKey: ["employees", "all-names"],
    queryFn: async () => (await api.get<Page<{ id: number; name: string }>>("/employees/", { params: { size: 200 } })).data.items,
    enabled: can.view,
  });
  const names = Object.fromEntries((emps.data ?? []).map((e) => [e.id, e.name]));
  const s = settings.data;
  if (!s) return null;
  const put = (data: Parameters<typeof save.mutate>[0]) => save.mutate(data, { onSuccess: () => notifyOk("Saqlandi"), onError: notifyError });
  return (
    <div className="card grid gap-4 p-4">
      {!s.distribution_enabled && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Taqsimlash o'chiq — «Vazifalar va qo'shimchalar»da yoqing.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {([["round_robin", "Navbat bilan", "Har yangi lid navbatdagi xodimga"], ["least_open", "Eng kam yuklanganga", "Ochiq lidlari eng kam xodimga"]] as const).map(([m, t, d]) => (
          <button key={m} type="button" onClick={() => put({ distribution_mode: m })}
            className={`rounded-xl border p-3 text-left ${s.distribution_mode === m ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"}`}>
            <p className="font-semibold">{t}</p><p className="text-xs text-muted">{d}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        <p className="t-label">Navbatdagi xodimlar</p>
        {s.distribution_managers.map((id, i) => (
          <div key={id} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-right tabular text-muted">{i + 1}.</span>
            <span className="flex-1">{names[id] ?? `Xodim #${id}`}</span>
            <IconButton label="Olib tashlash" onClick={() => put({ distribution_managers: s.distribution_managers.filter((x) => x !== id) })}><X className="size-4" /></IconButton>
          </div>
        ))}
        {!s.distribution_managers.length && <p className="text-sm text-warn">Hech kim belgilanmagan — taqsimlash ishlamaydi.</p>}
        {can.view && (
          <EntitySelect endpoint="employees" placeholder="+ xodim qo'shish" className="max-w-sm" extraParams={{ status: "active" }} value={null}
            onChange={(id) => {
              if (!id || s.distribution_managers.includes(id)) return;
              put({ distribution_managers: [...s.distribution_managers, id] });
            }} />
        )}
      </div>
    </div>
  );
}
