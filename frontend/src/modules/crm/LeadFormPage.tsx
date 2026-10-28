// Lid card: Odoo-style record page (ported from uzbridge crm/LeadCard.tsx) — fields by section with the
// company's own fields, tags, duplicates + merge, stage track, "Loyiha ochish", tasks, calls and the chatter.
import { Building2, ChevronDown, Copy, FileText, Phone, RotateCcw, Settings2, Trophy, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, ConfirmDialog, Dialog, Input, Menu, Pill, Select, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtMoney, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { REGIONS } from "@/modules/clients/api";
import { RefSelect } from "@/modules/references/RefSelect";
import { LeadCalls } from "@/modules/telephony/LeadCalls";
import { dial } from "@/modules/telephony/live";

import {
  LEAD_STATUS, TONE_DOT, leadsApi, useConvertLead, useFields, useMergeLead, useMoveLead, usePipelines,
  type FieldSection, type FieldValue, type Lead,
} from "./api";
import { LostDialog } from "./BoardPage";
import { FieldInput, TagsEditor } from "./cards";
import { LeadTasks } from "./LeadTasks";
import { FieldsSettings } from "./FieldsSettings";

type Values = {
  title: string; contact_name: string; phone: string; client_id: number | null; manager_id: number | null;
  source_id: number | null; budget: string; region: string; address: string; notes: string; tags: string[];
  custom: Record<string, FieldValue>;
};

const EMPTY: Values = {
  title: "", contact_name: "", phone: "", client_id: null, manager_id: null, source_id: null, budget: "0",
  region: "", address: "", notes: "", tags: [], custom: {},
};

const money = (v: string) => (/^\d+([.,]\d{1,2})?$/.test(v.replace(/[\s ]/g, "")) ? null : "Summa noto'g'ri");

export function LeadFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("crm");
  const canProjects = useCan("projects");
  const canClients = useCan("clients");
  const phoneOn = useCan("telephony").view;
  const detail = leadsApi.useDetail(isNew ? undefined : id);
  const save = leadsApi.useSave();
  const remove = leadsApi.useRemove();
  const fields = (useFields().data ?? []).filter((f) => f.active);
  const [gear, setGear] = useState<FieldSection | null>(null);
  const l = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, Lead>({
    initial: EMPTY,
    record: l,
    toForm: (r) => ({
      title: r.title, contact_name: r.contact_name, phone: r.phone, client_id: r.client_id, manager_id: r.manager_id,
      source_id: r.source_id, budget: String(Number(r.budget)), region: r.region, address: r.address, notes: r.notes,
      tags: r.tags, custom: r.values,
    }),
    validate: {
      title: (v, all) => (v.trim() || all.contact_name.trim() || all.phone.trim() || all.client_id ? null : "Nom, ism yoki telefon kerak"),
      budget: money,
    },
  });
  const v = form.values;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const custom = Object.fromEntries(Object.entries(v.custom).filter(([k, x]) => x !== l?.values[k]));
    save.mutate({ id, data: { ...v, budget: String(toNum(v.budget || "0")), custom } }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/crm/leads/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !l) return null;
  const section = (s: FieldSection) => fields.filter((f) => f.section === s);
  const fieldRows = (s: FieldSection) => section(s).map((f) => (
    <Row key={f.key} label={f.label}>
      <FieldInput field={f} value={v.custom[f.key]} disabled={!editable || (s === "contact" && !v.client_id)}
        onChange={(x) => form.set("custom", { ...v.custom, [f.key]: x })} />
    </Row>
  ));
  const gearButton = (s: FieldSection) => can.update && (
    <button type="button" onClick={() => setGear(s)} title="Maydonlar" className="text-muted hover:text-accent-ink"><Settings2 className="size-3.5" /></button>
  );

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={l ? { model: "crm.lead", id: l.id } : null}>
        <RecordNav listTo="/crm" listLabel="Voronka" crumb={l?.code ?? "Yangi"} navKey="crm" id={l?.id} />
        <ActionBar right={l && <StageTrack lead={l} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {l && !form.dirty && <LeadActions lead={l} canEdit={can.update} canConvert={canProjects.create} />}
          {l && phoneOn && l.phone && !form.dirty && (
            <Button variant="ghost" onClick={() => dial(l.phone)}><Phone className="size-4" strokeWidth={1.75} /> Qo'ng'iroq</Button>
          )}
          {l && can.delete && !form.dirty && !l.project && (
            <DeleteButton busy={remove.isPending} onConfirm={() => remove.mutate(l.id, { onSuccess: () => navigate("/crm"), onError: notifyError })} />
          )}
        </ActionBar>

        {l && l.duplicates.length > 0 && <Duplicates lead={l} canEdit={can.update} />}

        <Sheet>
          <SheetTitle
            eyebrow={l ? <>{l.code} · <Pill tone={LEAD_STATUS[l.status].tone}>{l.status === "open" ? l.stage.name : LEAD_STATUS[l.status].label}</Pill>
              {l.status === "open" && <span className="ml-1 text-muted">· {l.days_in_stage} kun shu bosqichda</span>}</> : "Lid"}
            title={isNew ? "Yangi lid" : l!.title}
            smart={l && (
              <>
                {l.project && canProjects.view && (
                  <Smart icon={<FileText className="size-4" />} value={l.project.code} label="Loyiha" onClick={() => navigate(`/projects/${l.project!.id}`)} />
                )}
                {l.client && canClients.view && (
                  <Smart icon={<Building2 className="size-4" />} value={l.client.code} label="Mijoz" onClick={() => navigate(`/clients/${l.client!.id}`)} />
                )}
              </>
            )}
          />
          {l?.status === "lost" && l.lost_reason && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">Rad sababi: {l.lost_reason}</p>}
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Nomi" wide error={form.errors.title}><Input placeholder="Masalan: 3 xonali kvartira derazalari" {...form.text("title")} /></Row>
              <Row label="Menejer">
                <EntitySelect endpoint="employees" current={l?.manager} disabled={!editable} extraParams={{ status: "active" }}
                  value={v.manager_id} onChange={(mid) => form.set("manager_id", mid)} />
              </Row>
              <Row label="Manba"><RefSelect kind="sales_channel" value={v.source_id} disabled={!editable} onChange={(x) => form.set("source_id", x)} /></Row>
              <Row label="Byudjet" error={form.errors.budget}><Input inputMode="decimal" className="tabular" {...form.text("budget")} /></Row>
              <Row label="Teglar"><TagsEditor value={v.tags} disabled={!editable} onChange={(t) => form.set("tags", t)} /></Row>
              {fieldRows("deal")}
            </FieldGrid>
            <FieldGrid title="Mijoz">
              <Row label="Aloqa shaxsi"><Input {...form.text("contact_name")} /></Row>
              <Row label="Telefon"><Input placeholder="+998 __ ___ __ __" {...form.text("phone")} /></Row>
              <Row label="Mijoz kartasi">
                <EntitySelect endpoint="clients" current={l?.client} disabled={!editable} placeholder="Raqam bo'yicha topiladi"
                  value={v.client_id} onChange={(cid) => form.set("client_id", cid)} />
              </Row>
              {fieldRows("contact")}
              {section("contact").length > 0 && !v.client_id && <p className="text-xs text-muted lg:col-span-2">Mijoz maydonlari mijoz kartasi biriktirilgach to'ldiriladi.</p>}
            </FieldGrid>
            <FieldGrid title="Obyekt">
              <Row label="Hudud">
                <Select {...form.text("region")}>
                  <option value="">—</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Row>
              <Row label="Manzil"><Input {...form.text("address")} /></Row>
              {fieldRows("extra")}
              <Row label="Izoh" wide><Textarea rows={3} {...form.text("notes")} /></Row>
            </FieldGrid>
          </fieldset>
          {can.update && (
            <p className="flex flex-wrap gap-3 text-xs text-muted">
              Maydonlar: {(["deal", "contact", "extra"] as FieldSection[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1">{{ deal: "Bitim", contact: "Mijoz", extra: "Qo'shimcha" }[s]} {gearButton(s)}</span>
              ))}
            </p>
          )}
        </Sheet>

        {l && <LeadTasks leadId={l.id} canEdit={can.update} open={l.status === "open"} />}
        {l && phoneOn && <LeadCalls leadId={l.id} />}
      </RecordPage>
      {gear && (
        <Dialog open onClose={() => setGear(null)} title="Lid maydonlari" width="max-w-2xl">
          <FieldsSettings section={gear} />
        </Dialog>
      )}
    </form>
  );
}

function StageTrack({ lead }: { lead: Lead }) {
  const pipelines = usePipelines();
  const stages = pipelines.data?.find((p) => p.id === lead.pipeline_id)?.stages ?? [];
  const steps = stages.filter((s) => !s.is_lost).map((s) => [String(s.id), s.name] as [string, string]);
  return <StatusTrack steps={steps} current={String(lead.stage.id)} off={lead.status === "lost" ? `Rad etildi${lead.lost_reason ? ` — ${lead.lost_reason}` : ""}` : undefined} />;
}

function Duplicates({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const merge = useMergeLead();
  const [ask, setAsk] = useState<number | null>(null);
  return (
    <section className="grid gap-2 rounded-xl border border-warn/40 bg-warn-soft/50 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-warn"><Copy className="size-4" /> Shu raqam bilan boshqa ochiq lidlar bor</p>
      {lead.duplicates.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-2">
          <span className={`size-2 rounded-full ${TONE_DOT[d.stage_tone]}`} />
          <Link to={`/crm/leads/${d.id}`} className="font-medium text-accent-ink hover:underline">{d.code} {d.title}</Link>
          <span className="text-xs text-muted">{d.stage}{d.manager && ` · ${d.manager}`}{d.pipeline && ` · ${d.pipeline}`}</span>
          {canEdit && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAsk(d.id)}>Shu yerga birlashtirish</Button>}
        </div>
      ))}
      <ConfirmDialog open={ask !== null} onClose={() => setAsk(null)} title="Lidlarni birlashtirish" busy={merge.isPending}
        text="Vazifalar, qo'ng'iroqlar, tarix, teglar va maydonlar shu lidga o'tadi; ikkinchisi «Dubl» sababi bilan yopiladi."
        confirmLabel="Birlashtirish"
        onConfirm={() => ask && merge.mutate({ id: ask, into_id: lead.id }, { onSuccess: () => { setAsk(null); notifyOk("Birlashtirildi"); }, onError: notifyError })} />
    </section>
  );
}

function LeadActions({ lead, canEdit, canConvert }: { lead: Lead; canEdit: boolean; canConvert: boolean }) {
  const pipelines = usePipelines();
  const move = useMoveLead();
  const convert = useConvertLead();
  const [lostOpen, setLostOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [projectName, setProjectName] = useState(lead.title);
  if (!canEdit) return null;
  const pipeline = pipelines.data?.find((p) => p.id === lead.pipeline_id);
  const stages = pipeline?.stages ?? [];
  const open = stages.filter((s) => !s.is_won && !s.is_lost);
  const next = lead.status === "open" ? open[open.findIndex((s) => s.id === lead.stage.id) + 1] : undefined;
  const lost = stages.find((s) => s.is_lost);
  const won = stages.find((s) => s.is_won);
  const go = (stageId: number, name: string) =>
    move.mutate({ id: lead.id, stage_id: stageId }, { onSuccess: () => notifyOk(`Bosqich: ${name}`), onError: notifyError });

  return (
    <>
      {lead.status === "open" && !lead.project && canConvert && (
        <Button onClick={() => setConvertOpen(true)}><Trophy className="size-4" strokeWidth={1.75} /> Loyiha ochish</Button>
      )}
      {next && <Button variant="soft" busy={move.isPending} onClick={() => go(next.id, next.name)}>{next.name} →</Button>}
      {lead.status !== "open" && !lead.project && open[0] && (
        <Button variant="soft" onClick={() => go(open[0].id, open[0].name)}><RotateCcw className="size-4" strokeWidth={1.75} /> Qayta ochish</Button>
      )}
      <Menu
        trigger={(o) => <Button variant="ghost" className={o ? "bg-ground" : ""}>Bosqich <ChevronDown className="size-3.5" /></Button>}
        items={stages.filter((s) => s.id !== lead.stage.id).map((s) => ({
          label: s.name,
          danger: s.is_lost,
          onClick: () => (s.is_lost ? setLostOpen(true) : go(s.id, s.name)),
        }))}
      />
      {lead.status === "open" && won && !canConvert && <Button variant="ghost" onClick={() => go(won.id, won.name)}>Yutildi</Button>}
      {lead.status === "open" && lost && (
        <Button variant="quiet" className="text-bad hover:text-bad" onClick={() => setLostOpen(true)}><XCircle className="size-4" strokeWidth={1.75} /> Rad etish</Button>
      )}
      <LostDialog open={lostOpen} busy={move.isPending} reasons={pipeline?.lost_reasons.map((r) => r.text)} onClose={() => setLostOpen(false)}
        onConfirm={(reason) => lost && move.mutate({ id: lead.id, stage_id: lost.id, lost_reason: reason }, {
          onSuccess: () => { setLostOpen(false); notifyOk("Rad etildi"); }, onError: notifyError,
        })} />
      <Dialog open={convertOpen} onClose={() => setConvertOpen(false)} title="Loyiha ochish"
        footer={<>
          <Button variant="ghost" onClick={() => setConvertOpen(false)}>Bekor qilish</Button>
          <Button busy={convert.isPending} onClick={() => convert.mutate({ id: lead.id, project_name: projectName }, {
            onSuccess: (r) => { setConvertOpen(false); notifyOk(`Loyiha ochildi: ${r.project?.code ?? ""}`); },
            onError: notifyError,
          })}>Loyiha ochish</Button>
        </>}>
        <p className="text-sm text-muted">
          {lead.client ? <>Mijoz: <b className="text-ink">{lead.client.name}</b>.</> : <>Mijoz yaratiladi: <b className="text-ink">{lead.contact_name || lead.title}</b>{lead.phone && <> · {lead.phone}</>} (shu raqamli mijoz bo'lsa — o'sha olinadi).</>}
          {" "}Loyiha qoralama holatida ochiladi, summa: {fmtMoney(lead.budget, "UZS")}. Lid «Yutildi» bosqichiga o'tadi.
        </p>
        <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Loyiha nomi" />
      </Dialog>
    </>
  );
}

