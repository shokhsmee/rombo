// The voronka's stages: rename, recolour, reorder, add, delete (won / lost stay).
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, Dialog, IconButton, Input, Select, type Tone } from "@/components/ui";
import { notifyError } from "@/lib/notify";

import { TONE_DOT, useDeleteStage, useSaveStage, type Pipeline } from "./api";

const TONES: [Tone, string][] = [
  ["accent", "Ko'k"], ["info", "Moviy"], ["done", "Binafsha"], ["warn", "Sariq"], ["neutral", "Kulrang"], ["ok", "Yashil"], ["bad", "Qizil"],
];

export function StagesDialog({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const save = useSaveStage();
  const remove = useDeleteStage();
  const [name, setName] = useState("");
  const open = pipeline.stages.filter((s) => !s.is_won && !s.is_lost);

  const swap = (i: number, j: number) => {
    const a = open[i], b = open[j];
    if (!a || !b) return;
    save.mutate({ id: a.id, position: b.position }, { onError: notifyError });
    save.mutate({ id: b.id, position: a.position }, { onError: notifyError });
  };

  return (
    <Dialog open onClose={onClose} title={`Bosqichlar — ${pipeline.name}`} width="max-w-lg"
      footer={<Button variant="ghost" onClick={onClose}>Yopish</Button>}>
      <div className="grid gap-1.5">
        {pipeline.stages.map((s) => {
          const i = open.findIndex((o) => o.id === s.id);
          return (
            <div key={s.id} className="flex items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-full ${TONE_DOT[s.tone]}`} />
              <Input defaultValue={s.name} className="flex-1"
                onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && save.mutate({ id: s.id, name: e.target.value.trim() }, { onError: notifyError })} />
              <Select className="w-28" value={s.tone} onChange={(e) => save.mutate({ id: s.id, tone: e.target.value as Tone }, { onError: notifyError })}>
                {TONES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
              </Select>
              {i >= 0 ? (
                <>
                  <IconButton label="Yuqoriga" disabled={i === 0} onClick={() => swap(i, i - 1)}><ArrowUp className="size-4" /></IconButton>
                  <IconButton label="Pastga" disabled={i === open.length - 1} onClick={() => swap(i, i + 1)}><ArrowDown className="size-4" /></IconButton>
                  <IconButton label="O'chirish" onClick={() => remove.mutate(s.id, { onError: notifyError })}><Trash2 className="size-4 text-bad" /></IconButton>
                </>
              ) : <span className="w-[104px] text-center text-2xs text-muted">{s.is_won ? "yutildi" : "rad etildi"}</span>}
            </div>
          );
        })}
      </div>
      <form className="flex gap-2 border-t border-line pt-3"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate({ pipeline_id: pipeline.id, name: name.trim(), tone: "neutral" }, { onSuccess: () => setName(""), onError: notifyError }); }}>
        <Input placeholder="Yangi bosqich" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="soft" busy={save.isPending}><Plus className="size-4" /> Qo'shish</Button>
      </form>
    </Dialog>
  );
}
