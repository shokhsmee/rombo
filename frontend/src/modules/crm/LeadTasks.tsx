// A lead's tasks: what to do next and when (call back, measure the object, meet). Lives inside the record
// <form>, so it has no <form> of its own: Enter and the button add a task.
import dayjs from "dayjs";
import { AlarmClock, Trash2 } from "lucide-react";
import { useState } from "react";

import { Checkbox, IconButton, Input, Select, Spinner } from "@/components/ui";
import { notifyError } from "@/lib/notify";

import { TASK_KIND, tasksApi, type TaskKind } from "./api";

const KINDS = Object.entries(TASK_KIND) as [TaskKind, string][];

export function LeadTasks({ leadId, canEdit }: { leadId: number; canEdit: boolean }) {
  const list = tasksApi.useList({ lead: leadId, size: 100 });
  const save = tasksApi.useSave();
  const remove = tasksApi.useRemove();
  const [kind, setKind] = useState<TaskKind>("call");
  const [text, setText] = useState("");
  const [due, setDue] = useState(() => dayjs().add(1, "hour").startOf("hour").format("YYYY-MM-DDTHH:mm"));
  const items = list.data?.items ?? [];

  const add = () =>
    save.mutate({ data: { lead_id: leadId, kind, text: text.trim(), due_at: due ? dayjs(due).toISOString() : null } }, {
      onSuccess: () => setText(""), onError: notifyError,
    });

  return (
    <section className="grid gap-2">
      <h2 className="t-h2">Vazifalar <span className="text-sm font-normal text-muted">{items.filter((t) => !t.done).length}</span></h2>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-ground/50 p-2.5">
            <Select className="w-36" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Input className="min-w-40 flex-1" placeholder="Nima qilish kerak…" value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
            <Input type="datetime-local" className="w-48" value={due} onChange={(e) => setDue(e.target.value)} />
            <button type="button" onClick={add} disabled={save.isPending}
              className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent-soft px-3.5 text-sm font-medium text-accent-ink hover:bg-accent/15 disabled:opacity-50">
              {save.isPending && <Spinner />} Qo'shish
            </button>
          </div>
        )}
        {items.map((t) => {
          const overdue = !t.done && t.due_at && dayjs(t.due_at).isBefore(dayjs());
          return (
            <div key={t.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
              <Checkbox checked={t.done} disabled={!canEdit} label="Bajarildi"
                onChange={(done) => save.mutate({ id: t.id, data: { done } }, { onError: notifyError })} />
              <div className={`min-w-0 flex-1 ${t.done ? "text-muted line-through" : ""}`}>
                <span className="font-medium">{TASK_KIND[t.kind]}</span>
                {t.text && <span className="text-muted"> — {t.text}</span>}
              </div>
              <span className={`flex items-center gap-1 whitespace-nowrap text-xs ${overdue ? "font-semibold text-bad" : "text-muted"}`}>
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
        {!items.length && !list.isLoading && <p className="px-3 py-5 text-center text-sm text-muted">Vazifa yo'q — keyingi qadamni rejalashtiring.</p>}
      </div>
    </section>
  );
}
