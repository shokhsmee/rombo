import dayjs from "dayjs";
import { ArrowUpRight, Building2, CalendarClock, ChevronDown, HardHat, Lock, MapPin, Send, Trash2, Upload, UserRoundCog, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, ConfirmDialog, Dialog, Input, Menu, Pill, Select, Smart, Spinner, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { apiError } from "@/lib/api";
import { fmtDateTime, fmtMoney, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { requestsApi, useAssign, useChangeStatus, useRequestPhotos, type ServicePhoto, type ServiceRequest } from "./api";
import { ASSIGNABLE, FINISHED, KIND, PAGE_MASTERS, PAGE_REQUESTS, PIPELINE, SOURCE, STAGE, STATUS, actionLabel, type PhotoStage, type RequestKind, type RequestStatus } from "./labels";
import { Stars } from "./RequestsListPage";

type Values = {
  client_id: number | null;
  project_id: number | null;
  kind: RequestKind;
  description: string;
  phone: string;
  address: string;
  /** "41.311, 69.279" — one box, split into latitude / longitude on save */
  location: string;
  preferred_date: string;
  is_warranty: boolean;
  price: string;
};

const EMPTY: Values = {
  client_id: null, project_id: null, kind: "other", description: "", phone: "", address: "",
  location: "", preferred_date: "", is_warranty: false, price: "0",
};

const money = (v: string) => (/^\d+([.,]\d{1,2})?$/.test(v.replace(/[\s ]/g, "") || "0") ? null : "Summa noto'g'ri");
const num = (v: string | null) => (v == null ? "" : String(Number(v)));
const POINT = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
/** "41.311, 69.279" → ["41.311000", "69.279000"]; empty → nulls; anything else → undefined */
const parsePoint = (v: string | undefined): [string, string] | [null, null] | undefined => {
  if (!v?.trim()) return [null, null];
  const m = v.match(POINT);
  if (!m || Math.abs(Number(m[1])) > 90 || Math.abs(Number(m[2])) > 180) return undefined;
  return [Number(m[1]).toFixed(6), Number(m[2]).toFixed(6)];
};
const pointOf = (lat: string | null, lng: string | null) => (lat != null && lng != null ? `${num(lat)}, ${num(lng)}` : "");

export function RequestFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan(PAGE_REQUESTS);
  const canClients = useCan("clients");
  const canProjects = useCan("projects");
  const canMasters = useCan(PAGE_MASTERS);
  const detail = requestsApi.useDetail(isNew ? undefined : id);
  const save = requestsApi.useSave();
  const remove = requestsApi.useRemove();
  const r = detail.data;
  const [assignOpen, setAssignOpen] = useState(false);

  const locked = !!r && FINISHED.includes(r.status);
  const editable = (isNew ? can.create : can.update) && !locked;

  const form = useServerForm<Values, ServiceRequest>({
    initial: EMPTY,
    record: r,
    toForm: (x) => ({
      client_id: x.client_id, project_id: x.project_id, kind: x.kind, description: x.description, phone: x.phone,
      address: x.address, location: pointOf(x.latitude, x.longitude), preferred_date: x.preferred_date ?? "",
      is_warranty: x.is_warranty, price: String(Number(x.price)),
    }),
    validate: {
      client_id: (x) => (x ? null : "Mijozni tanlang"),
      description: (x) => (x.trim() ? null : "Muammoni yozing"),
      price: money,
      location: (x) => (parsePoint(x) ? null : "Kenglik, uzunlik — masalan 41.311, 69.279"),
    },
  });
  const v = form.values;

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.check()) return;
    const [latitude, longitude] = parsePoint(v.location)!;
    const data = {
      client_id: v.client_id, project_id: v.project_id, kind: v.kind, description: v.description,
      address: v.address, latitude, longitude,
      preferred_date: v.preferred_date || null, is_warranty: v.is_warranty, price: String(toNum(v.price || "0")),
      // on create an empty phone means "take the client's"
      ...(isNew && !v.phone.trim() ? {} : { phone: v.phone }),
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/service/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err, { latitude: "location", longitude: "location" }),
    });
  };

  const point = parsePoint(v.location);
  const mapUrl = point?.[0] ? `https://maps.google.com/?q=${Number(point[0])},${Number(point[1])}` : null;

  if (!isNew && !r) return null;
  const linkBtn = "press grid size-9 shrink-0 place-items-center rounded-lg border border-line text-accent-ink hover:border-accent";

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={r ? { model: "maintenance.servicerequest", id: r.id } : null}>
        <RecordNav listTo="/service" listLabel="Servis arizalari" crumb={r?.code ?? "Yangi"} navKey="service" id={r?.id} />

        <ActionBar right={r && <StatusTrack steps={PIPELINE.map((s) => [s, STATUS[s].label])} current={r.status}
          off={r.status === "cancelled" ? STATUS.cancelled.label : undefined} />}>
          {(isNew ? can.create : can.update) && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {r && !form.dirty && can.update && ASSIGNABLE.includes(r.status) && (
            <Button variant={r.status === "new" ? "primary" : "ghost"} onClick={() => setAssignOpen(true)}>
              <UserRoundCog className="size-4" strokeWidth={1.75} /> {r.master ? "Ustani o'zgartirish" : "Ustaga berish"}
            </Button>
          )}
          {r && !form.dirty && <StatusActions request={r} canUpdate={can.update} />}
          {r?.status === "new" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Ariza o'chiriladi. Davom etasizmi?"
              onConfirm={() => remove.mutate(r.id, { onSuccess: () => navigate("/service"), onError: notifyError })} />
          )}
        </ActionBar>

        {locked && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-sunk/60 px-3 py-2 text-sm text-muted">
            <Lock className="size-4 shrink-0" strokeWidth={1.75} />
            «{STATUS[r!.status].label}» arizani o'zgartirib bo'lmaydi.
          </div>
        )}

        <Sheet>
          <SheetTitle
            eyebrow={r ? `Servis arizasi · ${r.code} · ${SOURCE[r.source]}` : "Servis arizasi"}
            title={isNew ? "Yangi ariza" : `${KIND[r!.kind]} — ${r!.client.name}`}
            smart={r && (
              <>
                <Smart icon={<Building2 className="size-4" />} value={r.client.name} label="Mijoz"
                  onClick={canClients.view ? () => navigate(`/clients/${r.client_id}`) : undefined} />
                <Smart icon={<HardHat className="size-4" />} value={r.master?.name ?? "—"} label="Usta"
                  onClick={r.master && canMasters.view ? () => navigate(`/service/masters/${r.master!.id}`) : undefined} />
                {Number(r.price) > 0 && <Smart icon={<Wallet className="size-4" />} value={fmtMoney(r.price, "UZS")} label="Narx" />}
              </>
            )}
          />

          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid title="Mijoz">
              <Row label="Mijoz" required error={form.errors.client_id}>
                <div className="flex gap-2">
                  <EntitySelect endpoint="clients" className="min-w-0 flex-1" current={r?.client} disabled={!editable} error={form.errors.client_id}
                    value={v.client_id}
                    onChange={(cid, opt) => {
                      form.set("client_id", cid);
                      if (cid !== v.client_id) form.set("project_id", null);
                      const o = (opt ?? {}) as { phone?: string; latitude?: string | null; longitude?: string | null };
                      if (o.phone && !v.phone) form.set("phone", o.phone);
                      if (o.latitude && o.longitude && !v.location.trim()) form.set("location", pointOf(o.latitude, o.longitude));
                    }} />
                  {v.client_id && canClients.view && (
                    <Link to={`/clients/${v.client_id}`} title="Mijoz kartochkasi" className={linkBtn}><ArrowUpRight className="size-4" strokeWidth={1.75} /></Link>
                  )}
                </div>
                {r?.client_telegram && (
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted" title="Holat o'zgarishi mijozga botda yuboriladi">
                    <Pill tone="info"><Send className="mr-1 size-3" strokeWidth={1.75} /> Telegram</Pill>
                    mijoz botda
                  </span>
                )}
              </Row>
              <Row label="Loyiha" error={form.errors.project_id}>
                <div className="flex gap-2">
                  <EntitySelect endpoint="projects" className="min-w-0 flex-1" current={r?.project} error={form.errors.project_id}
                    disabled={!editable || !v.client_id} placeholder={v.client_id ? "Mijoz loyihalari…" : "Avval mijozni tanlang"}
                    extraParams={v.client_id ? { client: String(v.client_id) } : undefined}
                    value={v.project_id}
                    onChange={(pid) => {
                      form.set("project_id", pid);
                      if (pid && isNew) form.set("is_warranty", true); // our installation: warranty unless said otherwise
                    }} />
                  {v.project_id && canProjects.view && (
                    <Link to={`/projects/${v.project_id}`} title="Loyiha kartochkasi" className={linkBtn}><ArrowUpRight className="size-4" strokeWidth={1.75} /></Link>
                  )}
                </div>
              </Row>
              <Row label="Telefon" error={form.errors.phone}>
                <Input placeholder={isNew ? "Bo'sh bo'lsa — mijoz telefoni" : "+998 __ ___ __ __"} {...form.text("phone")} />
              </Row>
              <Row label="Manzil" error={form.errors.address}>
                <Input placeholder={isNew ? "Bo'sh bo'lsa — loyiha yoki mijoz manzili" : ""} {...form.text("address")} />
              </Row>
              <Row label="Lokatsiya" error={form.errors.location}>
                <div className="flex gap-2">
                  <Input placeholder="41.311, 69.279" inputMode="decimal" className="min-w-0 flex-1 tabular" {...form.text("location")} />
                  {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer" title="Xaritada ochish" className={linkBtn}>
                      <MapPin className="size-4" strokeWidth={1.75} />
                    </a>
                  )}
                </div>
              </Row>
              <Row label="Qulay sana"><Input type="date" {...form.text("preferred_date")} /></Row>
            </FieldGrid>

            <FieldGrid title="Muammo">
              <Row label="Turi">
                <Select value={v.kind} onChange={(e) => form.set("kind", e.target.value as RequestKind)}>
                  {(Object.entries(KIND) as [RequestKind, string][]).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </Select>
              </Row>
              <Row label="Kafolat">
                <div className="flex h-9 items-center">
                  <Toggle label={v.is_warranty ? "Kafolat bo'yicha" : "Pullik"} checked={v.is_warranty} disabled={!editable} onChange={(x) => form.set("is_warranty", x)} />
                </div>
              </Row>
              <Row label="Tavsif" required error={form.errors.description} wide>
                <Textarea rows={3} placeholder="Masalan: balkon eshigi yopilmayapti, tutqich bo'shab qolgan" {...form.text("description")} />
              </Row>
              <Row label="Narx" error={form.errors.price}>
                <Input inputMode="decimal" className="tabular" placeholder="0" {...form.text("price")} />
              </Row>
            </FieldGrid>
          </fieldset>

          {r && (
            <FieldGrid title="Usta va vaqt">
              <Row label="Usta">
                <div className="flex h-9 items-center gap-2 text-sm">
                  {r.master
                    ? canMasters.view ? <Link to={`/service/masters/${r.master.id}`} className="font-medium text-accent-ink hover:underline">{r.master.name}</Link>
                      : <span className="font-medium">{r.master.name}</span>
                    : <span className="text-muted">Biriktirilmagan</span>}
                </div>
              </Row>
              <Row label="Kelish vaqti">
                <div className="flex h-9 items-center gap-2 text-sm">
                  <CalendarClock className="size-4 text-muted" strokeWidth={1.75} />
                  {r.scheduled_at ? fmtDateTime(r.scheduled_at) : <span className="text-muted">Belgilanmagan</span>}
                </div>
              </Row>
              <Row label="Bosqichlar" wide>
                <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-xs text-muted">
                  <span>Yaratildi: <b className="font-medium text-ink">{fmtDateTime(r.created_at)}</b></span>
                  {r.assigned_at && <span>Ustaga berildi: <b className="font-medium text-ink">{fmtDateTime(r.assigned_at)}</b></span>}
                  {r.started_at && <span>Boshlandi: <b className="font-medium text-ink">{fmtDateTime(r.started_at)}</b></span>}
                  {r.done_at && <span>Bajarildi: <b className="font-medium text-ink">{fmtDateTime(r.done_at)}</b></span>}
                  {r.closed_at && <span>{r.status === "cancelled" ? "Bekor qilindi" : "Yopildi"}: <b className="font-medium text-ink">{fmtDateTime(r.closed_at)}</b></span>}
                </div>
              </Row>
            </FieldGrid>
          )}

          {r && (r.report || r.rating || r.feedback || r.cancel_reason || ["done", "closed"].includes(r.status)) && (
            <FieldGrid title="Natija">
              <Row label="Usta hisoboti" wide>
                <p className="whitespace-pre-wrap pt-2 text-sm">{r.report || <span className="text-muted">—</span>}</p>
              </Row>
              <Row label="Mijoz bahosi"><div className="flex h-9 items-center"><Stars value={r.rating} /></div></Row>
              <Row label="Mijoz fikri">
                <p className="whitespace-pre-wrap pt-2 text-sm">{r.feedback || <span className="text-muted">—</span>}</p>
              </Row>
              {r.cancel_reason && (
                <Row label="Bekor qilish sababi" wide><p className="whitespace-pre-wrap pt-2 text-sm text-bad">{r.cancel_reason}</p></Row>
              )}
            </FieldGrid>
          )}

          <FieldGrid title="Rasmlar">
            {r ? (["before", "after"] as PhotoStage[]).map((stage) => (
              <Row key={stage} label={STAGE[stage]} wide>
                <Photos request={r} stage={stage} canEdit={can.update && !locked} />
              </Row>
            )) : <Row label="Rasmlar" wide><p className="pt-2 text-sm text-muted">Rasmlarni ariza saqlangandan keyin yuklang.</p></Row>}
          </FieldGrid>
        </Sheet>
      </RecordPage>
      {r && assignOpen && <AssignDialog request={r} onClose={() => setAssignOpen(false)} />}
    </form>
  );
}

/** "Ustaga berish": pick an active master and, optionally, when they come. Reassigning is allowed. */
function AssignDialog({ request, onClose }: { request: ServiceRequest; onClose: () => void }) {
  const assign = useAssign(request.id);
  const [master, setMaster] = useState<number | null>(request.master?.id ?? null);
  const [when, setWhen] = useState(request.scheduled_at ? dayjs(request.scheduled_at).format("YYYY-MM-DDTHH:mm") : "");
  const [error, setError] = useState<string>();
  const run = () => assign.mutate({ master_id: master!, scheduled_at: when ? dayjs(when).format() : null }, {
    onSuccess: (x) => { notifyOk(`Usta: ${x.master?.name ?? ""}`); onClose(); },
    onError: (e) => {
      const a = apiError(e);
      setError(a.fields.master_id ?? (a.field === "master_id" ? a.message : undefined));
      notifyError(e);
    },
  });
  return (
    <Dialog open onClose={onClose} title={request.master ? "Ustani o'zgartirish" : "Ustaga berish"}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button disabled={!master} busy={assign.isPending} onClick={run}>Berish</Button>
      </>}>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Usta</span>
        <EntitySelect endpoint="maintenance/masters" extraParams={{ is_active: "true" }} current={request.master} error={error}
          value={master} onChange={(m) => { setMaster(m); setError(undefined); }}
          describe={(o) => `${String(o.active_jobs ?? 0)} ochiq ish`} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Kelish vaqti</span>
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        {request.preferred_date && <span className="text-xs text-muted">Mijozga qulay sana: {dayjs(request.preferred_date).format("DD.MM.YYYY")}</span>}
      </label>
      <p className="text-xs text-muted">Usta botda bo'lsa, ish unga darhol yuboriladi.</p>
    </Dialog>
  );
}

function StatusActions({ request, canUpdate }: { request: ServiceRequest; canUpdate: boolean }) {
  const change = useChangeStatus(request.id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [comment, setComment] = useState("");

  // "assigned" goes through "Ustaga berish"
  const allowed = request.allowed_statuses.filter((s) => s !== "assigned");
  if (!canUpdate || allowed.length === 0) return null;

  const at = PIPELINE.indexOf(request.status);
  const forward = allowed.filter((s) => s !== "cancelled" && PIPELINE.indexOf(s) > at)
    .sort((a, b) => PIPELINE.indexOf(a) - PIPELINE.indexOf(b));
  const others = allowed.filter((s) => !forward.includes(s))
    .sort((a, b) => (a === "cancelled" ? 1 : b === "cancelled" ? -1 : 0));
  // with no master yet the main button is "Ustaga berish" — status moves wait in "Boshqa"
  const primary: RequestStatus | undefined = request.status === "new" ? undefined : forward[0];
  const rest = [...forward.filter((s) => s !== primary), ...others];

  const run = (status: RequestStatus) => {
    if (status === "cancelled") return setCancelOpen(true);
    change.mutate({ status }, { onSuccess: () => notifyOk(`Holat: ${STATUS[status].label}`), onError: notifyError });
  };

  return (
    <>
      {primary && <Button busy={change.isPending} onClick={() => run(primary)}>{actionLabel(primary, request.status)}</Button>}
      {rest.length > 0 && (
        <Menu
          trigger={() => <Button variant="ghost">Boshqa <ChevronDown className="size-3.5" strokeWidth={1.75} /></Button>}
          items={rest.map((s) => ({ label: actionLabel(s, request.status), danger: s === "cancelled", onClick: () => run(s) }))}
        />
      )}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Arizani bekor qilish"
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
        <p className="text-sm text-muted">Sabab tarixga yoziladi{request.client_telegram ? " va mijozga yuboriladi" : ""}. Bekor qilingan arizani qayta ochib bo'lmaydi.</p>
        <Textarea autoFocus rows={3} placeholder="Sabab…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
    </>
  );
}

/** Photos of one stage: thumbnails open full size in a new tab; upload several at once. */
function Photos({ request, stage, canEdit }: { request: ServiceRequest; stage: PhotoStage; canEdit: boolean }) {
  const { upload, remove } = useRequestPhotos(request.id);
  const input = useRef<HTMLInputElement>(null);
  const [del, setDel] = useState<ServicePhoto | null>(null);
  const photos = request.photos.filter((p) => p.stage === stage);

  const send = (list: FileList | null) => {
    Array.from(list ?? []).forEach((file) =>
      upload.mutate({ file, stage }, { onSuccess: () => notifyOk(`Yuklandi: ${file.name}`), onError: notifyError }));
    if (input.current) input.current.value = "";
  };

  return (
    <div className="grid grid-cols-3 gap-2 pt-1 sm:grid-cols-5 xl:grid-cols-6">
      {photos.map((p) => (
        <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-sunk">
          <a href={p.url} target="_blank" rel="noopener noreferrer" title={fmtDateTime(p.created_at)}>
            <img src={p.url} alt={STAGE[stage]} loading="lazy" className="size-full object-cover" />
          </a>
          {canEdit && (
            <button type="button" aria-label="O'chirish" title="O'chirish" onClick={() => setDel(p)}
              className="press absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-surface/90 text-muted opacity-0 shadow-sm hover:text-bad group-hover:opacity-100 focus:opacity-100">
              <Trash2 className="size-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <button type="button" onClick={() => input.current?.click()}
          className="press grid aspect-square place-items-center rounded-lg border border-dashed border-line-strong text-muted hover:border-accent hover:text-ink">
          <span className="grid justify-items-center gap-1 text-xs">
            {upload.isPending ? <Spinner /> : <Upload className="size-4" strokeWidth={1.75} />}
            Rasm qo'shish
          </span>
        </button>
      )}
      {!canEdit && photos.length === 0 && <p className="col-span-full pt-1 text-sm text-muted">Rasm yo'q</p>}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => send(e.target.files)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Rasmni o'chirish" text="Rasm o'chiriladi. Davom etasizmi?"
        confirmLabel="O'chirish" danger busy={remove.isPending}
        onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => { setDel(null); notifyOk("O'chirildi"); }, onError: notifyError })} />
    </div>
  );
}
