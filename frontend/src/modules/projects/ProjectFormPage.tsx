import { Building2, CalendarClock, ChevronDown, Lock, Wallet } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, Dialog, Input, Menu, Select, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDate, fmtMoney } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { projectsApi, useChangeStatus, type Currency, type Project, type ProjectStatus } from "./api";
import { ACTION_LABEL, PIPELINE, STATUS } from "./statuses";

type Values = {
  name: string;
  client_id: number | null;
  manager_id: number | null;
  object_address: string;
  region: string;
  contract_number: string;
  contract_date: string;
  deadline: string;
  amount: string;
  currency: Currency;
  notes: string;
};

const EMPTY: Values = {
  name: "", client_id: null, manager_id: null, object_address: "", region: "", contract_number: "",
  contract_date: "", deadline: "", amount: "0", currency: "UZS", notes: "",
};

const EDITABLE: ProjectStatus[] = ["draft", "confirmed"];

export function ProjectFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("projects");
  const detail = projectsApi.useDetail(isNew ? undefined : id);
  const save = projectsApi.useSave();
  const remove = projectsApi.useRemove();
  const p = detail.data;

  const locked = !!p && !EDITABLE.includes(p.status);
  const editable = (isNew ? can.create : can.update) && !locked;

  const form = useServerForm<Values, Project>({
    initial: EMPTY,
    record: p,
    toForm: (r) => ({
      name: r.name, client_id: r.client_id, manager_id: r.manager_id, object_address: r.object_address,
      region: r.region, contract_number: r.contract_number, contract_date: r.contract_date ?? "",
      deadline: r.deadline ?? "", amount: String(Number(r.amount)), currency: r.currency, notes: r.notes,
    }),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      client_id: (v) => (v ? null : "Mijozni tanlang"),
      amount: (v) => (/^\d+([.,]\d{1,2})?$/.test(v.replace(/\s/g, "")) ? null : "Summa noto'g'ri"),
    },
  });
  const v = form.values;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = {
      ...v,
      amount: v.amount.replace(/\s/g, "").replace(",", "."),
      contract_date: v.contract_date || null,
      deadline: v.deadline || null,
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/projects/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !p) return null;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={p ? { model: "projects.project", id: p.id } : null}>
        <RecordNav listTo="/projects" listLabel="Loyihalar" crumb={p?.code ?? "Yangi"} navKey="projects" id={p?.id} />

        <ActionBar right={p && <StatusTrack steps={PIPELINE.map((s) => [s, STATUS[s].label])} current={p.status}
          off={p.status === "cancelled" ? STATUS.cancelled.label : undefined} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {p && !form.dirty && <StatusActions project={p} canUpdate={can.update} />}
          {p?.status === "draft" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              onConfirm={() => remove.mutate(p.id, { onSuccess: () => navigate("/projects"), onError: notifyError })} />
          )}
        </ActionBar>

        {locked && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-sunk/60 px-3 py-2 text-sm text-muted">
            <Lock className="size-4" />
            «{STATUS[p!.status].label}» bosqichida asosiy ma'lumotlar qulflangan — xarid va MRP rejalari shularga tayanadi.
          </div>
        )}

        <Sheet>
          <SheetTitle
            eyebrow={p ? `Loyiha · ${p.code}` : "Loyiha"}
            title={isNew ? "Yangi loyiha" : p!.name}
            smart={p && (
              <>
                <Smart icon={<Building2 className="size-4" />} value={p.client.name} label="Mijoz" onClick={() => navigate(`/clients/${p.client_id}`)} />
                <Smart icon={<Wallet className="size-4" />} value={fmtMoney(p.amount, p.currency)} label="Shartnoma summasi" />
                <Smart icon={<CalendarClock className="size-4" />} value={fmtDate(p.deadline)} label="Topshirish muddati" />
              </>
            )}
          />

          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Loyiha nomi" required error={form.errors.name} wide>
                <Input {...form.text("name")} placeholder="Masalan: Turar-joy majmuasi, 3-blok derazalar" />
              </Row>
              <Row label="Mijoz" required error={form.errors.client_id}>
                <EntitySelect endpoint="clients" current={p?.client} disabled={!editable} error={form.errors.client_id}
                  value={v.client_id} onChange={(cid) => form.set("client_id", cid)} />
              </Row>
              <Row label="Mas'ul menejer">
                <EntitySelect endpoint="employees" current={p?.manager} disabled={!editable} extraParams={{ status: "active" }}
                  value={v.manager_id} onChange={(mid) => form.set("manager_id", mid)} />
              </Row>
            </FieldGrid>

            <FieldGrid title="Shartnoma">
              <Row label="Shartnoma №"><Input {...form.text("contract_number")} /></Row>
              <Row label="Shartnoma sanasi"><Input type="date" {...form.text("contract_date")} /></Row>
              <Row label="Summa" error={form.errors.amount}>
                <div className="flex gap-2">
                  <Input inputMode="decimal" className="tabular" {...form.text("amount")} />
                  <Select className="w-24" value={v.currency} onChange={(e) => form.set("currency", e.target.value as Currency)}>
                    <option value="UZS">so'm</option>
                    <option value="USD">USD</option>
                  </Select>
                </div>
              </Row>
              <Row label="Topshirish muddati"><Input type="date" {...form.text("deadline")} /></Row>
            </FieldGrid>

            <FieldGrid title="Obyekt">
              <Row label="Hudud"><Input {...form.text("region")} /></Row>
              <Row label="Manzil"><Input {...form.text("object_address")} /></Row>
              <Row label="Izoh" wide><Textarea {...form.text("notes")} /></Row>
            </FieldGrid>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}

function StatusActions({ project, canUpdate }: { project: Project; canUpdate: boolean }) {
  const change = useChangeStatus(project.id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [comment, setComment] = useState("");

  if (!canUpdate || project.allowed_statuses.length === 0) return null;

  // the forward move is the primary button; going back and cancelling sit in "Boshqa"
  const forward: ProjectStatus[] = project.allowed_statuses.filter((s) => s !== "cancelled" && s !== "draft");
  const others = project.allowed_statuses.filter((s) => !forward.includes(s));
  const primary = forward[0];

  const run = (status: ProjectStatus) => {
    if (status === "cancelled") return setCancelOpen(true);
    change.mutate({ status }, { onSuccess: () => notifyOk(`Holat: ${STATUS[status].label}`), onError: notifyError });
  };

  return (
    <>
      {primary && <Button busy={change.isPending} onClick={() => run(primary)}>{ACTION_LABEL[primary]}</Button>}
      {forward.length + others.length > 1 && (
        <Menu
          trigger={() => <Button variant="ghost">Boshqa <ChevronDown className="size-3.5" /></Button>}
          items={[...forward.slice(1), ...others].map((s) => ({ label: ACTION_LABEL[s], danger: s === "cancelled", onClick: () => run(s) }))}
        />
      )}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Loyihani bekor qilish"
        footer={<>
          <Button variant="ghost" onClick={() => setCancelOpen(false)}>Yopish</Button>
          <Button variant="danger" disabled={!comment.trim()} busy={change.isPending}
            onClick={() => change.mutate({ status: "cancelled", comment }, {
              onSuccess: () => { setCancelOpen(false); setComment(""); notifyOk("Bekor qilindi"); },
              onError: notifyError,
            })}>
            Bekor qilish
          </Button>
        </>}>
        <p className="text-sm text-muted">Sabab tarixga yoziladi. Bekor qilingan loyihani keyin qoralamaga qaytarish mumkin.</p>
        <Textarea autoFocus rows={3} placeholder="Sabab…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
    </>
  );
}
