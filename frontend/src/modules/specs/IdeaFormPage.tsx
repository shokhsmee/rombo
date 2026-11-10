import { Bot, Copy, FileCode2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, Dialog, Input, Pill, Select, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { notifyError, notifyOk } from "@/lib/notify";

import { fetchProposal, ideasApi, useIdeaStatus, type Idea } from "./api";
import { ACTION, KIND, PAGE_IDEAS, PRIORITY, SOURCE, STATUS, type IdeaKind, type IdeaPriority, type IdeaStatus } from "./labels";

type Values = {
  title: string; kind: IdeaKind; capability: string; priority: IdeaPriority; problem: string; proposal: string;
  impact: string; change_id: string;
};

const EMPTY: Values = { title: "", kind: "fix", capability: "", priority: "normal", problem: "", proposal: "", impact: "", change_id: "" };
const TRACK: IdeaStatus[] = ["new", "accepted", "done"];

export function IdeaFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan(PAGE_IDEAS);
  const detail = ideasApi.useDetail(isNew ? undefined : id);
  const save = ideasApi.useSave();
  const remove = ideasApi.useRemove();
  const r = detail.data;
  const editable = (isNew ? can.create : can.update) && r?.status !== "done";

  const form = useServerForm<Values, Idea>({
    initial: EMPTY,
    record: r,
    toForm: (x) => ({
      title: x.title, kind: x.kind, capability: x.capability, priority: x.priority, problem: x.problem,
      proposal: x.proposal, impact: x.impact, change_id: x.change_id,
    }),
    validate: {
      title: (x) => (x.trim().length >= 3 ? null : "Kamida 3 ta belgi"),
      problem: (x) => (x.trim() ? null : "Muammoni yozing"),
    },
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.check()) return;
    save.mutate({ id, data: form.values }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/system/ideas/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !r) return null;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={r ? { model: "specs.fixidea", id: r.id } : null}>
        <RecordNav listTo="/system/ideas" listLabel="Takliflar" crumb={r?.code ?? "Yangi"} navKey="fix_ideas" id={r?.id} />
        <ActionBar right={r && (
          <StatusTrack steps={TRACK.map((s) => [s, STATUS[s].label])} current={r.status}
            off={r.status === "rejected" ? <Pill tone="bad">Rad etildi</Pill> : undefined} />
        )}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {r && !form.dirty && can.update && <StatusButtons idea={r} />}
          {r && !form.dirty && <ProposalButton idea={r} />}
          {r && can.delete && r.status === "new" && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Taklif o'chiriladi. Davom etasizmi?"
              onConfirm={() => remove.mutate(r.id, { onSuccess: () => navigate("/system/ideas"), onError: notifyError })} />
          )}
        </ActionBar>

        <Sheet>
          <SheetTitle eyebrow={r ? <>Taklif · {r.code}{r.source === "mcp" && <span className="ml-2 inline-flex items-center gap-1 text-accent"><Bot className="size-3.5" strokeWidth={1.75} />{SOURCE.mcp}</span>}</> : "Taklif"}
            title={isNew ? "Yangi taklif" : r!.title} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Sarlavha" required error={form.errors.title} wide><Input {...form.text("title")} /></Row>
              <Row label="Turi" error={form.errors.kind}>
                <Select value={form.values.kind} onChange={(e) => form.set("kind", e.target.value as IdeaKind)}>
                  {(Object.keys(KIND) as IdeaKind[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}
                </Select>
              </Row>
              <Row label="Muhimlik" error={form.errors.priority}>
                <Select value={form.values.priority} onChange={(e) => form.set("priority", e.target.value as IdeaPriority)}>
                  {(Object.keys(PRIORITY) as IdeaPriority[]).map((k) => <option key={k} value={k}>{PRIORITY[k].label}</option>)}
                </Select>
              </Row>
              <Row label="Bo'lim (capability)" error={form.errors.capability}><Input placeholder="procurement" {...form.text("capability")} /></Row>
              <Row label="OpenSpec o'zgarish" error={form.errors.change_id}><Input placeholder="fix-…" {...form.text("change_id")} /></Row>
            </FieldGrid>
            <FieldGrid title="Mazmun">
              <Row label="Muammo" required error={form.errors.problem} wide><Textarea rows={5} {...form.text("problem")} /></Row>
              <Row label="Taklif" error={form.errors.proposal} wide><Textarea rows={5} {...form.text("proposal")} /></Row>
              <Row label="Ta'sir" error={form.errors.impact} wide><Textarea rows={2} placeholder="Ilovalar, jadvallar, endpointlar, sahifalar" {...form.text("impact")} /></Row>
              {r?.resolution && <Row label="Qaror izohi" wide><p className="py-2 text-sm whitespace-pre-wrap">{r.resolution}</p></Row>}
            </FieldGrid>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}

function StatusButtons({ idea }: { idea: Idea }) {
  const change = useIdeaStatus(idea.id);
  const [reject, setReject] = useState(false);
  const [comment, setComment] = useState("");
  const run = (status: IdeaStatus, c = "") =>
    change.mutate({ status, comment: c }, { onSuccess: () => { setReject(false); notifyOk(STATUS[status].label); }, onError: notifyError });
  return (
    <>
      {idea.allowed_statuses.filter((s) => s !== "rejected").map((s) => (
        <Button key={s} variant={s === "new" ? "ghost" : "primary"} busy={change.isPending} onClick={() => run(s)}>{ACTION[s]}</Button>
      ))}
      {idea.allowed_statuses.includes("rejected") && <Button variant="ghost" onClick={() => setReject(true)}>{ACTION.rejected}</Button>}
      <Dialog open={reject} onClose={() => setReject(false)} title="Taklifni rad etish"
        footer={<>
          <Button variant="ghost" onClick={() => setReject(false)}>Yopish</Button>
          <Button variant="danger" disabled={!comment.trim()} busy={change.isPending} onClick={() => run("rejected", comment)}>Rad etish</Button>
        </>}>
        <Textarea rows={3} placeholder="Sababi" value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
      </Dialog>
    </>
  );
}

/** The idea as an OpenSpec proposal.md draft, for the developer who opens the change. */
function ProposalButton({ idea }: { idea: Idea }) {
  const [md, setMd] = useState<string | null>(null);
  const open = () => fetchProposal(idea.id).then(setMd, notifyError);
  return (
    <>
      <Button variant="ghost" onClick={open}><FileCode2 className="size-4" strokeWidth={1.75} /> proposal.md</Button>
      <Dialog open={md != null} onClose={() => setMd(null)} title="OpenSpec proposal.md" width="max-w-2xl"
        footer={<>
          <Button variant="ghost" onClick={() => setMd(null)}>Yopish</Button>
          <Button onClick={() => { void navigator.clipboard?.writeText(md ?? ""); notifyOk("Nusxa olindi"); }}>
            <Copy className="size-4" strokeWidth={1.75} /> Nusxa olish
          </Button>
        </>}>
        <pre className="overflow-x-auto rounded-lg bg-sunk px-3 py-2 font-mono text-xs whitespace-pre-wrap">{md}</pre>
      </Dialog>
    </>
  );
}
