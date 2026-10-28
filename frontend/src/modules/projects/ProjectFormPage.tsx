import dayjs from "dayjs";
import { Building2, ChevronDown, ExternalLink, Lock, Ruler, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, Dialog, Input, Menu, Pill, Select, Smart, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtArea, fmtMoney, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { RefSelect } from "@/modules/references/RefSelect";

import { projectsApi, useChangeStatus, type Currency, type Project, type ProjectStatus } from "./api";
import { Drawings } from "./Drawings";
import { emptyRow, ItemsEditor, itemsError, type ItemRow } from "./ItemsEditor";
import { ACTION_LABEL, PIPELINE, STATUS } from "./statuses";

type Values = {
  name: string;
  client_id: number | null;
  phone: string;
  object_address: string;
  location: string;
  region: string;
  sale_date: string;
  deadline: string;
  manager_id: number | null;
  partner_id: number | null;
  sales_channel_id: number | null;
  brand_id: number | null;
  product_name: string;
  items: ItemRow[];
  mosquito_net: boolean;
  dismantling: boolean;
  amount: string;
  service_amount: string;
  advance_amount: string;
  currency: Currency;
  contract_number: string;
  contract_date: string;
  notes: string;
};

const today = () => dayjs().format("YYYY-MM-DD"); // local date, not UTC

const EMPTY: Values = {
  name: "", client_id: null, phone: "", object_address: "", location: "", region: "", sale_date: today(), deadline: "",
  manager_id: null, partner_id: null, sales_channel_id: null, brand_id: null, product_name: "", items: [emptyRow()],
  mosquito_net: false, dismantling: false, amount: "0", service_amount: "0", advance_amount: "0", currency: "UZS",
  contract_number: "", contract_date: "", notes: "",
};

const EDITABLE: ProjectStatus[] = ["draft", "confirmed"];
const money = (v: string) => (/^\d+([.,]\d{1,2})?$/.test(v.replace(/[\s ]/g, "")) ? null : "Summa noto'g'ri");
const apiMoney = (v: string) => String(toNum(v || "0"));
const asLink = (loc: string) =>
  /^https?:\/\//.test(loc) ? loc
    : /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(loc) ? `https://maps.google.com/?q=${loc.replace(/\s/g, "")}` : null;

export function ProjectFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("projects");
  const detail = projectsApi.useDetail(isNew ? undefined : id);
  const save = projectsApi.useSave();
  const remove = projectsApi.useRemove();
  const p = detail.data;

  const canEdit = isNew ? can.create : can.update;
  // from procurement on, only what production depends on is locked; money, contacts and dates stay open
  const prodLocked = !!p && !EDITABLE.includes(p.status);

  const form = useServerForm<Values, Project>({
    initial: EMPTY,
    record: p,
    toForm: (r) => ({
      name: r.name, client_id: r.client_id, phone: r.phone, object_address: r.object_address, location: r.location,
      region: r.region, sale_date: r.sale_date ?? "", deadline: r.deadline ?? "", manager_id: r.manager_id,
      partner_id: r.partner_id, sales_channel_id: r.sales_channel_id, brand_id: r.brand_id, product_name: r.product_name,
      items: r.items.map((i) => ({ product_type_id: i.product_type_id, area_m2: String(Number(i.area_m2)), quantity: String(i.quantity) })),
      mosquito_net: r.mosquito_net, dismantling: r.dismantling, amount: String(Number(r.amount)),
      service_amount: String(Number(r.service_amount)), advance_amount: String(Number(r.advance_amount)), currency: r.currency,
      contract_number: r.contract_number, contract_date: r.contract_date ?? "", notes: r.notes,
    }),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      client_id: (v) => (v ? null : "Mijozni tanlang"),
      amount: money, service_amount: money, advance_amount: money,
      items: (rows) => itemsError(rows),
    },
  });
  const v = form.values;
  const debt = (toNum(v.amount) || 0) + (toNum(v.service_amount) || 0) - (toNum(v.advance_amount) || 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = {
      ...v,
      amount: apiMoney(v.amount), service_amount: apiMoney(v.service_amount), advance_amount: apiMoney(v.advance_amount),
      sale_date: v.sale_date || null, deadline: v.deadline || null, contract_date: v.contract_date || null,
      items: v.items.map((r) => ({ product_type_id: r.product_type_id!, area_m2: String(toNum(r.area_m2)), quantity: toNum(r.quantity) })),
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
          {canEdit && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {p && !form.dirty && <StatusActions project={p} canUpdate={can.update} />}
          {p?.status === "draft" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              onConfirm={() => remove.mutate(p.id, { onSuccess: () => navigate("/projects"), onError: notifyError })} />
          )}
        </ActionBar>

        {prodLocked && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-sunk/60 px-3 py-2 text-sm text-muted">
            <Lock className="size-4 shrink-0" />
            «{STATUS[p!.status].label}» bosqichida mahsulot ma'lumotlari qulflangan. Summalar, avans, telefon va sanalarni o'zgartirish mumkin.
          </div>
        )}

        <Sheet>
          <SheetTitle
            eyebrow={p ? `Buyurtma № ${p.code}` : "Yangi buyurtma"}
            title={isNew ? "Yangi loyiha" : p!.name}
            smart={p && (
              <>
                <Smart icon={<Building2 className="size-4" />} value={p.client.name} label="Mijoz" onClick={() => navigate(`/clients/${p.client_id}`)} />
                <Smart icon={<Wallet className="size-4" />} value={fmtMoney(p.total_amount, p.currency)} label="Jami summa" />
                <Smart icon={<Wallet className="size-4 text-bad" />} value={<span className={Number(p.debt_amount) > 0 ? "text-bad" : "text-ok"}>{fmtMoney(p.debt_amount, p.currency)}</span>} label="Qarz" />
                <Smart icon={<Ruler className="size-4" />} value={fmtArea(p.total_area)} label={`${p.total_quantity} dona buyum`} />
              </>
            )}
          />

          <fieldset disabled={!canEdit} className="grid gap-6">
            <FieldGrid>
              <Row label="Loyiha nomi" required error={form.errors.name} wide>
                <Input {...form.text("name")} disabled={prodLocked} placeholder="Masalan: Xususiy uy — derazalar va eshiklar" />
              </Row>
            </FieldGrid>

            <FieldGrid title="Buyurtma">
              <Row label="Buyurtma №"><Input value={p?.code ?? "saqlanganda beriladi"} disabled className="font-mono" /></Row>
              <Row label="Sotuv sanasi"><Input type="date" {...form.text("sale_date")} /></Row>
              <Row label="Mijoz (F.I.O.)" required error={form.errors.client_id}>
                <EntitySelect endpoint="clients" current={p?.client} disabled={!canEdit || prodLocked} error={form.errors.client_id}
                  value={v.client_id}
                  onChange={(cid, opt) => {
                    form.set("client_id", cid);
                    const phone = (opt as { phone?: string } | null)?.phone;
                    if (phone && !v.phone) form.set("phone", phone);
                  }} />
              </Row>
              <Row label="Telefon"><Input placeholder="+998 __ ___ __ __" {...form.text("phone")} /></Row>
              <Row label="Manzil"><Input {...form.text("object_address")} /></Row>
              <Row label="Lokatsiya">
                <div className="flex gap-2">
                  <Input placeholder="Xarita havolasi yoki 41.31, 69.27" {...form.text("location")} />
                  {asLink(v.location) && (
                    <a href={asLink(v.location)!} target="_blank" rel="noopener noreferrer" title="Xaritada ochish"
                      className="press grid size-9 shrink-0 place-items-center rounded-lg border border-line text-accent-ink hover:border-accent">
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>
              </Row>
              <Row label="Topshirish muddati"><Input type="date" {...form.text("deadline")} /></Row>
              <Row label="Mijoz segmenti">
                <div className="flex h-9 items-center gap-2">
                  {p?.client_segment ? <Pill tone="accent">{p.client_segment.name}</Pill> : <span className="text-sm text-muted">—</span>}
                  {p && <Link to={`/clients/${p.client_id}`} className="text-xs text-accent-ink hover:underline">mijoz kartochkasida</Link>}
                </div>
              </Row>
              <Row label="Sotuvchi">
                <EntitySelect endpoint="employees" current={p?.manager} disabled={!canEdit} extraParams={{ status: "active" }}
                  value={v.manager_id} onChange={(mid) => form.set("manager_id", mid)} />
              </Row>
              <Row label="Hamkor">
                <EntitySelect endpoint="clients" current={p?.partner} disabled={!canEdit} extraParams={{ kind: "dealer" }}
                  placeholder="Diler / hamkor" value={v.partner_id} onChange={(pid) => form.set("partner_id", pid)} />
              </Row>
              <Row label="Sotuv kanali">
                <RefSelect kind="sales_channel" value={v.sales_channel_id} onChange={(x) => form.set("sales_channel_id", x)} />
              </Row>
            </FieldGrid>

            <FieldGrid title="Mahsulot">
              <Row label="Brend">
                <RefSelect kind="brand" value={v.brand_id} disabled={prodLocked} onChange={(x) => form.set("brand_id", x)} />
              </Row>
              <Row label="Mahsulot nomi"><Input {...form.text("product_name")} disabled={prodLocked} /></Row>
              <Row label="Buyurtma turi" wide>
                <ItemsEditor rows={v.items} disabled={!canEdit || prodLocked} error={form.errors.items}
                  onChange={(rows) => form.set("items", rows)} />
              </Row>
              <Row label="Qo'shimcha">
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                  <Toggle label="Maskitka" checked={v.mosquito_net} disabled={!canEdit || prodLocked} onChange={(x) => form.set("mosquito_net", x)} />
                  <Toggle label="Demontaj" checked={v.dismantling} disabled={!canEdit || prodLocked} onChange={(x) => form.set("dismantling", x)} />
                </div>
              </Row>
            </FieldGrid>

            <FieldGrid title="Moliya">
              <Row label="Buyurtma summasi" error={form.errors.amount}>
                <div className="flex gap-2">
                  <Input inputMode="decimal" className="tabular" {...form.text("amount")} />
                  <Select className="w-24" value={v.currency} onChange={(e) => form.set("currency", e.target.value as Currency)}>
                    <option value="UZS">so'm</option>
                    <option value="USD">USD</option>
                  </Select>
                </div>
              </Row>
              <Row label="Xizmat summasi" error={form.errors.service_amount}>
                <Input inputMode="decimal" className="tabular" placeholder="O'rnatish, yetkazish…" {...form.text("service_amount")} />
              </Row>
              <Row label="Avans" error={form.errors.advance_amount}><Input inputMode="decimal" className="tabular" {...form.text("advance_amount")} /></Row>
              <Row label="Qarz">
                <div className={`flex h-9 items-center rounded-lg px-3 text-sm font-semibold tabular ${debt > 0 ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}>
                  {fmtMoney(debt, v.currency)}
                </div>
                <span className="text-xs text-muted">= buyurtma + xizmat − avans</span>
              </Row>
              <Row label="Shartnoma №"><Input {...form.text("contract_number")} /></Row>
              <Row label="Shartnoma sanasi"><Input type="date" {...form.text("contract_date")} /></Row>
            </FieldGrid>

            <FieldGrid title="Izoh">
              <Row label="Izoh" wide><Textarea {...form.text("notes")} placeholder="Masalan: 2-qavat, lift yo'q" /></Row>
            </FieldGrid>
          </fieldset>

          <FieldGrid title="Chizma">
            <Row label="Fayllar" wide>
              {p ? <Drawings projectId={p.id} files={p.files} canEdit={can.update} />
                : <p className="pt-2 text-sm text-muted">Chizmalarni loyiha saqlangandan keyin yuklang.</p>}
            </Row>
          </FieldGrid>
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
