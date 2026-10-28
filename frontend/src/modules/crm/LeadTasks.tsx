// A lead's tasks: what to do next and when (call back, measure the object, meet). Lives inside the record
// <form>, so it has no <form> of its own: Enter and the button add a task. Types come from CRM settings.
import dayjs from "dayjs";
import { AlarmClock, AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";

import { Checkbox, IconButton, Input, Select, Spinner } from "@/components/ui";
import { notifyError } from "@/lib/notify";

import { tasksApi, useCrmSettings } from "./api";

const QUICK_DUE: [string, () => dayjs.Dayjs][] = [
  ["1 soatdan keyin", () => dayjs().add(1, "hour").startOf("minute")],
  ["Bugun 18:00", () => dayjs().hour(18).minute(0)],
  ["Ertaga 10:00", () => dayjs().add(1, "day").hour(10).minute(0)],
  ["Bir haftadan keyin", () => dayjs().add(7, "day").hour(10).minute(0)],
];

export function LeadTasks({ leadId, canEdit, open }: { leadId: number; canEdit: boolean; open: boolean }) {
  const list = tasksApi.useList({ lead: leadId, size: 100 });
  const save = tasksApi.useSave();
  const remove = tasksApi.useRemove();
  const types = useCrmSettings().data?.task_types ?? [];
  const [kind, setKind] = useState("");
  const [text, setText] = useState("");
  const [due, setDue] = useState(() => dayjs().add(1, "hour").startOf("hour").format("YYYY-MM-DDTHH:mm"));
  const items = list.data?.items ?? [];
  const pending = items.filter((t) => !t.done).length;

  const add = () =>
    save.mutate({ data: { lead_id: leadId, kind: kind || types[0], text: text.trim(), due_at: due ? dayjs(due).toISOString() : null } }, {
      onSuccess: () => setText(""), onError: notifyError,
    });

  return (
    <section className="grid gap-2">
      <h2 className="t-h2">Vazifalar <span className="text-sm font-normal text-muted">{pending}</span></h2>
      {open && canEdit && !pending && !list.isLoading && (
        <p className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          <AlertTriangle className="size-4" /> Keyingi qadam rejalashtirilmagan — vazifa qo'ying
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {canEdit && (
          <div className="grid gap-2 border-b border-line bg-ground/50 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Select className="w-40" value={kind || types[0] || ""} onChange={(e) => setKind(e.target.value)}>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Input className="min-w-40 flex-1" placeholder="Nima qilish kerak…" value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
              <Input type="datetime-local" className="w-48" value={due} onChange={(e) => setDue(e.target.value)} />
              <button type="button" onClick={add} disabled={save.isPending || !types.length}
                className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent-soft px-3.5 text-sm font-medium text-accent-ink hover:bg-accent/15 disabled:opacity-50">
                {save.isPending && <Spinner />} Qo'shish
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DUE.map(([label, at]) => (
                <button key={label} type="button" onClick={() => setDue(at().format("YYYY-MM-DDTHH:mm"))}
                  className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:text-ink">{label}</button>
              ))}
            </div>
          </div>
        )}
        {items.map((t) => {
          const overdue = !t.done && t.due_at && dayjs(t.due_at).isBefore(dayjs());
          const today = !t.done && t.due_at && dayjs(t.due_at).isSame(dayjs(), "day");
          return (
            <div key={t.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
              <Checkbox checked={t.done} disabled={!canEdit} label="Bajarildi"
                onChange={(done) => save.mutate({ id: t.id, data: { done } }, { onError: notifyError })} />
              <div className={`min-w-0 flex-1 ${t.done ? "text-muted line-through" : ""}`}>
                <span className="font-medium">{t.kind}</span>
                {t.text && <span className="text-muted"> — {t.text}</span>}
              </div>
              <span className={`flex items-center gap-1 whitespace-nowrap text-xs ${overdue ? "font-semibold text-bad" : today ? "text-warn" : "text-muted"}`}>
                <AlarmClock className="size-3.5" strokeWidth={1.75} />
                {t.due_at ? dayjs(t.due_at).format("DD.MM HH:mm") : "muddatsiz"}
              </span>
              {t.assignee && <span className="hidden text-xs text-muted sm:inline">{t.assignee.full_name}</span>}
              {canEdit && (
                <IconButton label="O'chirish" onClick={() => remove.mutate(t.id, { onError: notifyError })}>
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </IconButton>
              )}
            </div>
          );
        })}
        {!items.length && !list.isLoading && <p className="px-3 py-5 text-center text-sm text-muted">Vazifa yo'q.</p>}
      </div>
    </section>
  );
}
