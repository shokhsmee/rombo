import { Banknote, FileText } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { ActivePill } from "@/components/Status";
import { Input, Pill, Segmented, Select, Smart, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDate, fmtMoney } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { useOrdersOf } from "@/modules/kassa/api";
import { projectsApi } from "@/modules/projects/api";
import { RefSelect } from "@/modules/references/RefSelect";
import { STATUS } from "@/modules/projects/statuses";

import { clientsApi, KIND_LABEL, REGIONS, type Client, type ClientKind } from "./api";
import { LocationField } from "./LocationField";

type Values = {
  kind: ClientKind; name: string; tin: string; contact_person: string; phone: string; phone_extra: string;
  email: string; region: string; address: string; source: string; notes: string; is_active: boolean;
  manager_id: number | null; segment_id: number | null; passport: string;
  latitude: number | null; longitude: number | null;
  bank_account: string; bank_name: string; mfo: string; price_currency: "UZS" | "USD"; prepay_percent: string; credit_days: string;
};

const EMPTY: Values = {
  kind: "individual", name: "", tin: "", contact_person: "", phone: "", phone_extra: "", email: "",
  region: "", address: "", source: "", notes: "", is_active: true, manager_id: null, segment_id: null, passport: "",
  latitude: null, longitude: null, bank_account: "", bank_name: "", mfo: "", price_currency: "UZS", prepay_percent: "", credit_days: "",
};

export function ClientFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("clients");
  const canProjects = useCan("projects");
  const canCash = useCan("cash_orders");
  const detail = clientsApi.useDetail(isNew ? undefined : id);
  const save = clientsApi.useSave();
  const remove = clientsApi.useRemove();
  const c = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, Client>({
    initial: EMPTY,
    record: c,
    toForm: (r) => ({
      kind: r.kind, name: r.name, tin: r.tin, contact_person: r.contact_person, phone: r.phone,
      phone_extra: r.phone_extra, email: r.email, region: r.region, address: r.address, source: r.source,
      notes: r.notes, is_active: r.is_active, manager_id: r.manager_id, segment_id: r.segment_id,
      passport: r.passport,
      latitude: r.latitude == null ? null : Number(r.latitude), longitude: r.longitude == null ? null : Number(r.longitude),
      bank_account: r.bank_account, bank_name: r.bank_name, mfo: r.mfo, price_currency: r.price_currency,
      prepay_percent: r.prepay_percent == null ? "" : String(r.prepay_percent), credit_days: r.credit_days == null ? "" : String(r.credit_days),
    }),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      tin: (v) => (!v || /^\d{9,14}$/.test(v) ? null : "9–14 ta raqam"),
    },
  });
  const v = form.values;
  const company = v.kind !== "individual";
  const supplier = v.kind === "supplier";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = { ...v, prepay_percent: v.prepay_percent === "" ? null : Number(v.prepay_percent), credit_days: v.credit_days === "" ? null : Number(v.credit_days) };
    save.mutate({ id, data }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/clients/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !c) return null;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={c ? { model: "clients.client", id: c.id } : null}>
        <RecordNav listTo="/clients" listLabel="Mijozlar" crumb={c?.code ?? "Yangi"} navKey="clients" id={c?.id} />
        <ActionBar right={c && <ActivePill active={c.is_active} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {c && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              text={c.projects_count ? "Mijozda loyihalar bor — o'chirib bo'lmaydi. Uni nofaol qiling." : undefined}
              onConfirm={() => remove.mutate(c.id, { onSuccess: () => navigate("/clients"), onError: notifyError })} />
          )}
        </ActionBar>

        <Sheet>
          <SheetTitle
            eyebrow={c ? `${KIND_LABEL[c.kind]} · ${c.code}` : "Mijoz"}
            title={isNew ? "Yangi mijoz" : c!.name}
            smart={c && (
              <>
                {canProjects.view && (
                  <Smart icon={<FileText className="size-4" />} value={c.projects_count} label="Loyihalar"
                    onClick={() => navigate(`/projects?client=${c.id}`)} />
                )}
                {canCash.view && <PaymentsSmart clientId={c.id} />}
              </>
            )}
          />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Turi" wide>
                <div className="no-scrollbar max-w-full overflow-x-auto">
                  <Segmented value={v.kind} onChange={(k) => form.set("kind", k)}
                    options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value: value as ClientKind, label }))} />
                </div>
              </Row>
              <Row label={company ? "Tashkilot nomi" : "F.I.O."} required error={form.errors.name}><Input {...form.text("name")} /></Row>
              <Row label="STIR" error={form.errors.tin}><Input inputMode="numeric" placeholder={company ? "9 ta raqam" : "ixtiyoriy"} {...form.text("tin")} /></Row>
              {company && <Row label="Aloqa shaxsi"><Input {...form.text("contact_person")} /></Row>}
              <Row label="Mas'ul menejer">
                <EntitySelect endpoint="employees" current={c?.manager} disabled={!editable} extraParams={{ status: "active" }}
                  value={v.manager_id} onChange={(mid) => form.set("manager_id", mid)} />
              </Row>
              <Row label="Segment">
                <RefSelect kind="client_segment" value={v.segment_id} onChange={(x) => form.set("segment_id", x)} />
              </Row>
            </FieldGrid>
            <FieldGrid title="Aloqa">
              <Row label="Telefon" error={form.errors.phone}><Input placeholder="+998 __ ___ __ __" {...form.text("phone")} /></Row>
              <Row label="Qo'sh. telefon"><Input {...form.text("phone_extra")} /></Row>
              <Row label="Email" error={form.errors.email}><Input type="email" {...form.text("email")} /></Row>
              <Row label="Qayerdan kelgan"><Input placeholder="Tavsiya, Instagram, ko'rgazma…" {...form.text("source")} /></Row>
            </FieldGrid>
            <FieldGrid title="Manzil">
              <Row label="Hudud">
                <Select {...form.text("region")}>
                  <option value="">—</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Row>
              <Row label="Manzil"><Input {...form.text("address")} /></Row>
              {!company && <Row label="Pasport"><Input placeholder="AA 1234567" className="font-mono" {...form.text("passport")} /></Row>}
              <Row label="Lokatsiya" wide>
                <LocationField disabled={!editable} error={form.errors.latitude ?? form.errors.longitude}
                  value={v.latitude != null && v.longitude != null ? { lat: v.latitude, lng: v.longitude } : null}
                  onChange={(p) => { form.set("latitude", p?.lat ?? null); form.set("longitude", p?.lng ?? null); }} />
              </Row>
              <Row label="Izoh" wide><Textarea {...form.text("notes")} /></Row>
              <Row label="Holat"><Toggle label="Faol mijoz" checked={v.is_active} disabled={!editable} onChange={(x) => form.set("is_active", x)} /></Row>
            </FieldGrid>
            {company && (
              <FieldGrid title="Bank rekvizitlari">
                <Row label="Hisob raqami"><Input className="font-mono" {...form.text("bank_account")} /></Row>
                <Row label="Bank"><Input {...form.text("bank_name")} /></Row>
                <Row label="MFO"><Input className="w-32 font-mono" {...form.text("mfo")} /></Row>
              </FieldGrid>
            )}
            {supplier && (
              <FieldGrid title="Yetkazib beruvchi shartlari">
                <Row label="Narx valyutasi">
                  <Select className="w-32" value={v.price_currency} onChange={(e) => form.set("price_currency", e.target.value as "UZS" | "USD")}>
                    <option value="UZS">so'm</option>
                    <option value="USD">USD</option>
                  </Select>
                </Row>
                <Row label="Oldindan to'lov, %"><Input inputMode="numeric" className="w-32 tabular" {...form.text("prepay_percent")} /></Row>
                <Row label="Kredit kunlari"><Input inputMode="numeric" className="w-32 tabular" {...form.text("credit_days")} /></Row>
              </FieldGrid>
            )}
          </fieldset>
        </Sheet>

        {c && canProjects.view && c.projects_count > 0 && <ClientProjects clientId={c.id} total={c.projects_count} />}
      </RecordPage>
    </form>
  );
}

/** "To'lovlar": the partner's cash orders (as a client or as a supplier), opens the filtered list. */
function PaymentsSmart({ clientId }: { clientId: number }) {
  const navigate = useNavigate();
  const list = useOrdersOf({ partner: clientId, size: 1 });
  return <Smart icon={<Banknote className="size-4" />} value={list.data?.total ?? "…"} label="To'lovlar" onClick={() => navigate(`/kassa/orders?partner=${clientId}`)} />;
}

function ClientProjects({ clientId, total }: { clientId: number; total: number }) {
  const list = projectsApi.useList({ client: clientId, size: 6, sort: "-created_at" });
  return (
    <section className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="t-h2">Loyihalar <span className="text-sm font-normal text-muted">{total}</span></h2>
        {total > 6 && <Link to={`/projects?client=${clientId}`} className="text-sm text-accent-ink hover:underline">Barchasi →</Link>}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {list.data?.items.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-ground">
            <span className="font-mono text-xs text-muted">{p.code}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            <span className="text-xs text-muted">{fmtDate(p.deadline)}</span>
            <span className="tabular text-sm">{fmtMoney(p.amount, p.currency)}</span>
            <Pill tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Pill>
          </Link>
        ))}
      </div>
    </section>
  );
}
