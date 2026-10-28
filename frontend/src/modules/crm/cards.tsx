// Kanban card setup, quick edit, custom-field editors and the tags editor (ported from uzbridge crm/cards.tsx).
import dayjs from "dayjs";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useState } from "react";

import { EntitySelect } from "@/components/EntitySelect";
import { Button, Checkbox, Dialog, Input, Pill, Select } from "@/components/ui";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { RefSelect } from "@/modules/references/RefSelect";

import {
  leadsApi, tagTone, tasksApi, useCrmSettings, useMoveLead, useSaveCrmSettings,
  type FieldValue, type LeadCard, type LeadField, type Stage,
} from "./api";

export const STANDARD_CARD: [string, string][] = [
  ["customer", "Mijoz"], ["phone", "Telefon"], ["budget", "Byudjet"], ["tags", "Teglar"], ["source", "Manba"],
  ["manager", "Menejer"], ["task", "Keyingi vazifa"], ["days", "Bosqichdagi kunlar"], ["created", "Kelgan sana"],
  ["activity", "Oxirgi faollik"],
];

// ------------------------------------------------------------------ field editors


export function FieldInput({ field, value, onChange, disabled }: {
  field: LeadField; value: FieldValue | undefined; onChange: (v: FieldValue) => void; disabled?: boolean;
}) {
  const v = value ?? "";
  if (field.type === "bool") return <Checkbox label={field.label} checked={value === true} disabled={disabled} onChange={(x) => onChange(x)} />;
  if (field.type === "select") {
    return (
      <Select value={String(v)} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    );
  }
  if (field.type === "date") return <Input type="date" value={String(v)} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} />;
  if (field.type === "number") {
    return <Input inputMode="decimal" className="tabular" value={String(v)} disabled={disabled}
      onChange={(e) => { const s = e.target.value.replace(/[^\d.,]/g, ""); onChange(s === "" ? null : toNum(s)); }} />;
  }
  if (field.type === "url" && disabled && v) return <a href={String(v)} target="_blank" rel="noreferrer" className="truncate pt-2 text-sm text-accent-ink hover:underline">{String(v)}</a>;
  return <Input value={String(v)} disabled={disabled} type={field.type === "url" ? "url" : "text"}
    placeholder={field.type === "phone" ? "+998 __ ___ __ __" : undefined} onChange={(e) => onChange(e.target.value || null)} />;
}

export function TagsEditor({ value, onChange, disabled }: { value: string[]; onChange: (t: string[]) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().slice(0, 40);
    if (t && !value.includes(t)) onChange([...value, t]);
    setText("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center">
          <Pill tone={tagTone(t)}>{t}{!disabled && <button type="button" aria-label="Olib tashlash" className="ml-1" onClick={() => onChange(value.filter((x) => x !== t))}><X className="size-3" /></button>}</Pill>
        </span>
      ))}
      {!disabled && (
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={add} placeholder="+ teg"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="h-7 w-24 rounded-md border border-dashed border-line bg-transparent px-2 text-xs outline-none focus:border-accent" />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ card setup

export function CardSetup({ fields, onClose }: { fields: LeadField[]; onClose: () => void }) {
  const settings = useCrmSettings();
  const save = useSaveCrmSettings();
  const [chosen, setChosen] = useState<string[]>(settings.data?.card_fields ?? []);
  const all: [string, string][] = [...STANDARD_CARD, ...fields.filter((f) => f.active).map((f) => [`f:${f.key}`, f.label] as [string, string])];
  const label = (k: string) => all.find(([x]) => x === k)?.[1] ?? k;
  const move = (i: number, d: number) => {
    const next = [...chosen];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setChosen(next);
  };
  return (
    <Dialog open onClose={onClose} title="Kartochka ko'rinishi" width="max-w-xl"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={save.isPending} onClick={() => save.mutate({ card_fields: chosen }, { onSuccess: () => { notifyOk("Saqlandi"); onClose(); }, onError: notifyError })}>Saqlash</Button>
      </>}>
      <p className="text-sm text-muted">Kanban kartochkasida nima ko'rinsin — barcha xodimlar uchun.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          {all.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox label={l} checked={chosen.includes(k)} onChange={(on) => setChosen(on ? [...chosen, k].slice(0, 16) : chosen.filter((x) => x !== k))} />
              {l}
            </label>
          ))}
        </div>
        <div className="grid content-start gap-1 rounded-lg bg-ground p-2">
          <p className="t-label px-1">Tartib</p>
          {chosen.map((k, i) => (
            <div key={k} className="flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-sm">
              <span className="flex-1 truncate">{label(k)}</span>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="text-muted disabled:opacity-30" aria-label="Yuqoriga"><ArrowUp className="size-3.5" /></button>
              <button type="button" disabled={i === chosen.length - 1} onClick={() => move(i, 1)} className="text-muted disabled:opacity-30" aria-label="Pastga"><ArrowDown className="size-3.5" /></button>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------ quick edit

export function QuickEdit({ lead, stages, fields, onClose }: { lead: LeadCard; stages: Stage[]; fields: LeadField[]; onClose: () => void }) {
  const save = leadsApi.useSave();
  const move = useMoveLead();
  const task = tasksApi.useSave();
  const settings = useCrmSettings();
  const [title, setTitle] = useState(lead.title);
  const [stageId, setStageId] = useState(lead.stage.id);
  const [managerId, setManagerId] = useState<number | null>(lead.manager?.id ?? null);
  const [budget, setBudget] = useState(String(Number(lead.budget)));
  const [sourceId, setSourceId] = useState<number | null>(lead.source?.id ?? null);
  const [tags, setTags] = useState(lead.tags);
  const [values, setValues] = useState<Record<string, FieldValue>>(lead.values);
  const [withTask, setWithTask] = useState(false);
  const [kind, setKind] = useState(settings.data?.task_types[0] ?? "Qo'ng'iroq");
  const [due, setDue] = useState(dayjs().add(1, "day").hour(10).minute(0).format("YYYY-MM-DDTHH:mm"));
  const [text, setText] = useState("");
  const busy = save.isPending || move.isPending || task.isPending;
  const stage = stages.find((s) => s.id === stageId);

  const submit = async () => {
    const data: Record<string, unknown> = {};
    if (title !== lead.title) data.title = title;
    if (managerId !== (lead.manager?.id ?? null)) data.manager_id = managerId;
    if (toNum(budget || "0") !== Number(lead.budget)) data.budget = String(toNum(budget || "0"));
    if (sourceId !== (lead.source?.id ?? null)) data.source_id = sourceId;
    if (JSON.stringify(tags) !== JSON.stringify(lead.tags)) data.tags = tags;
    const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== lead.values[k]));
    if (Object.keys(changed).length) data.custom = changed;
    try {
      if (Object.keys(data).length) await save.mutateAsync({ id: lead.id, data });
      if (stageId !== lead.stage.id && !stage?.is_lost) await move.mutateAsync({ id: lead.id, stage_id: stageId });
      if (withTask) await task.mutateAsync({ data: { lead_id: lead.id, kind, text, due_at: dayjs(due).toISOString() } });
      notifyOk("Saqlandi");
      onClose();
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`${lead.code} · tez tahrirlash`} width="max-w-2xl"
      footer={<><Button variant="ghost" onClick={onClose}>Bekor qilish</Button><Button busy={busy} onClick={submit}>Saqlash</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2"><span className="text-muted">Nomi</span><Input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="grid gap-1 text-sm"><span className="text-muted">Bosqich</span>
          <Select value={stageId} onChange={(e) => setStageId(Number(e.target.value))}>
            {stages.filter((s) => !s.is_lost).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm"><span className="text-muted">Menejer</span>
          <EntitySelect endpoint="employees" current={lead.manager} value={managerId} extraParams={{ status: "active" }} onChange={(id) => setManagerId(id)} />
        </label>
        <label className="grid gap-1 text-sm"><span className="text-muted">Byudjet</span><Input inputMode="decimal" className="tabular" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
        <label className="grid gap-1 text-sm"><span className="text-muted">Manba</span><RefSelect kind="sales_channel" value={sourceId} onChange={setSourceId} /></label>
        <div className="grid gap-1 text-sm sm:col-span-2"><span className="text-muted">Teglar</span><TagsEditor value={tags} onChange={setTags} /></div>
        {fields.filter((f) => f.active && (f.section !== "contact" || lead.client)).map((f) => (
          <label key={f.key} className="grid gap-1 text-sm"><span className="text-muted">{f.label}</span>
            <FieldInput field={f} value={values[f.key]} onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))} />
          </label>
        ))}
      </div>
      <div className="grid gap-2 rounded-lg border border-line p-3">
        <label className="flex items-center gap-2 text-sm"><Checkbox label="Vazifa qo'yish" checked={withTask} onChange={setWithTask} /> Vazifa qo'yish</label>
        {withTask && (
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {(settings.data?.task_types ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            <Input placeholder="Izoh" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        )}
      </div>
    </Dialog>
  );
}
