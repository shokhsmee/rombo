// The lead card's own fields (uzbridge crm/Settings.tsx FieldsSettings): add, rename, options, order, hide, delete.
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, ConfirmDialog, IconButton, Input, Pill, Select } from "@/components/ui";
import { notifyError, notifyOk } from "@/lib/notify";

import { FIELD_TYPES, SECTIONS, useDeleteField, useFields, useSaveField, type FieldSection, type FieldType } from "./api";

export function FieldsSettings({ section }: { section?: FieldSection }) {
  const fields = useFields();
  const save = useSaveField();
  const remove = useDeleteField();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [sec, setSec] = useState<FieldSection>(section ?? "extra");
  const [options, setOptions] = useState("");
  const [del, setDel] = useState<number | null>(null);
  const list = (fields.data ?? []).filter((f) => !section || f.section === section);
  const swap = (i: number, j: number) => {
    const a = list[i], b = list[j];
    const [pa, pb] = a.position === b.position ? [b.position + (j > i ? 1 : -1), a.position] : [b.position, a.position];
    save.mutate({ id: a.id, position: Math.max(0, pa) }, { onError: notifyError });
    save.mutate({ id: b.id, position: Math.max(0, pb) }, { onError: notifyError });
  };
  const create = () => save.mutate({
    label: label.trim(), type, section: sec, options: type === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
  }, { onSuccess: () => { setLabel(""); setOptions(""); notifyOk("Maydon qo'shildi"); }, onError: notifyError });

  return (
    <div className="grid gap-2">
      {list.map((f, i) => (
        <div key={f.id} className={`grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)_auto] ${f.active ? "" : "opacity-60"}`}>
          <Input defaultValue={f.label} onBlur={(e) => e.target.value.trim() && e.target.value !== f.label && save.mutate({ id: f.id, label: e.target.value.trim() }, { onError: notifyError })} />
          <Pill>{FIELD_TYPES.find(([t]) => t === f.type)?.[1]}</Pill>
          <Pill tone="info">{SECTIONS.find(([s]) => s === f.section)?.[1]}</Pill>
          {f.type === "select"
            ? <Input defaultValue={f.options.join(", ")} placeholder="Variantlar, vergul bilan"
                onBlur={(e) => save.mutate({ id: f.id, options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) }, { onError: notifyError })} />
            : <span className="font-mono text-2xs text-faint">{f.key}</span>}
          <span className="flex">
            <IconButton label="Yuqoriga" disabled={i === 0} onClick={() => swap(i, i - 1)}><ArrowUp className="size-4" /></IconButton>
            <IconButton label="Pastga" disabled={i === list.length - 1} onClick={() => swap(i, i + 1)}><ArrowDown className="size-4" /></IconButton>
            <IconButton label={f.active ? "Yashirish" : "Ko'rsatish"} onClick={() => save.mutate({ id: f.id, active: !f.active }, { onError: notifyError })}>
              {f.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </IconButton>
            <IconButton label="O'chirish" onClick={() => setDel(f.id)}><Trash2 className="size-4 text-bad" /></IconButton>
          </span>
        </div>
      ))}
      {!list.length && <p className="text-sm text-muted">Hali maydon yo'q. Masalan: xonalar soni, profil rangi, o'lchov sanasi.</p>}
      <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]">
        <Input placeholder="Yangi maydon nomi" value={label} onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && label.trim()) { e.preventDefault(); create(); } }} />
        <Select value={type} onChange={(e) => setType(e.target.value as FieldType)}>{FIELD_TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}</Select>
        <Select value={sec} disabled={!!section} onChange={(e) => setSec(e.target.value as FieldSection)}>{SECTIONS.map(([s, l]) => <option key={s} value={s}>{l}</option>)}</Select>
        <Button variant="soft" disabled={!label.trim()} busy={save.isPending} onClick={create}><Plus className="size-4" /> Qo'shish</Button>
        {type === "select" && <Input className="sm:col-span-4" placeholder="Variantlar, vergul bilan: Oq, Jigarrang, Antratsit" value={options} onChange={(e) => setOptions(e.target.value)} />}
      </div>
      <p className="text-xs text-muted">Turi va bo'limi yaratilgandan keyin o'zgarmaydi. «Mijoz» bo'limi qiymati mijozga tegishli — uning barcha lidlarida ko'rinadi.</p>
      <ConfirmDialog open={del !== null} onClose={() => setDel(null)} danger title="Maydonni o'chirish" busy={remove.isPending}
        text="Saqlangan qiymatlar ko'rinmay qoladi. Yashirish xavfsizroq." confirmLabel="O'chirish"
        onConfirm={() => del && remove.mutate(del, { onSuccess: () => setDel(null), onError: notifyError })} />
    </div>
  );
}

