// Telefoniya → Sozlamalar (uzbridge TelephonySettingsPanel): connections (UTeL, Moi Zvonki, IP-PBX), the CRM rules,
// who answers which number, Google Drive recordings.
import dayjs from "dayjs";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { FieldGrid, RecordNav, Row, SaveButtons, Sheet } from "@/components/Record";
import { Button, Dialog, IconButton, Input, Pill, Segmented, Select, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { notifyError, notifyOk } from "@/lib/notify";
import { usePipelines } from "@/modules/crm/api";
import { TagsEditor } from "@/modules/crm/cards";
import { RefSelect } from "@/modules/references/RefSelect";

import {
  useConnections, useDeleteExtension, useExtensions, useRecordings, useRecordingsAction, useSaveExtension,
  useSaveTelephonySettings, useTelephonySettings, type Extension, type ExtensionInput, type TelephonySettings, type UnknownAction,
} from "./api";
import { ConnectionsPanel } from "./ConnectionsPanel";

const TABS = [["connections", "Ulanishlar"], ["rules", "Qoidalar"], ["people", "Ichki raqamlar"], ["drive", "Yozuvlar (Drive)"]] as const;
type Tab = (typeof TABS)[number][0];

export function TelephonySettingsPage() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("google") ? "drive" : (sp.get("tab") as Tab)) || "connections";
  return (
    <div className="grid gap-3">
      <RecordNav listTo="/telephony" listLabel="Qo'ng'iroqlar" crumb="Sozlamalar" navKey="telephony" />
      <Segmented value={tab} onChange={(t) => setSp({ tab: t }, { replace: true })} options={TABS.map(([value, label]) => ({ value, label }))} />
      {tab === "connections" && <ConnectionsPanel group="telephony" />}
      {tab === "rules" && <Rules />}
      {tab === "people" && <Extensions />}
      {tab === "drive" && <Recordings />}
    </div>
  );
}

// ------------------------------------------------------------------ rules

const UNKNOWN: [UnknownAction, string][] = [["create_lead", "Lid yaratish"], ["create_contact", "Faqat mijoz yaratish"], ["nothing", "Hech narsa"]];
type RuleValues = Omit<TelephonySettings, "missed_task_minutes" | "min_duration"> & { missed_task_minutes: string; min_duration: string };

function Rules() {
  const can = useCan("telephony");
  const settings = useTelephonySettings();
  const save = useSaveTelephonySettings();
  const pipelines = usePipelines();
  const form = useServerForm<RuleValues, TelephonySettings>({
    initial: {} as RuleValues,
    record: settings.data,
    toForm: (r) => ({ ...r, missed_task_minutes: String(r.missed_task_minutes), min_duration: String(r.min_duration) }),
    validate: {
      missed_task_minutes: (v) => (/^\d+$/.test(v) && Number(v) >= 1 ? null : "Daqiqa soni"),
      min_duration: (v) => (/^\d+$/.test(v) ? null : "Soniya"),
    },
  });
  const v = form.values;
  if (!settings.data || v.incoming_unknown === undefined) return null;
  const pipeline = (pipelines.data ?? []).find((p) => p.id === v.pipeline_id) ?? (pipelines.data ?? []).find((p) => p.is_default);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    save.mutate({ ...v, missed_task_minutes: Number(v.missed_task_minutes), min_duration: Number(v.min_duration) }, {
      onSuccess: () => { notifyOk("Saqlandi"); form.commit(); }, onError: (err) => applyServerErrors(form, err),
    });
  };
  const sel = (k: "incoming_unknown" | "missed_unknown" | "outgoing_unknown") => (
    <Select value={v[k]} onChange={(e) => form.set(k, e.target.value as UnknownAction)}>{UNKNOWN.map(([x, l]) => <option key={x} value={x}>{l}</option>)}</Select>
  );
  return (
    <form onSubmit={submit}>
      <Sheet>
        <div className="flex items-center gap-2">
          <p className="t-h2 flex-1">Qo'ng'iroqlar CRM'da nima qiladi</p>
          {can.update && <SaveButtons dirty={form.dirty} saving={save.isPending} onReset={form.reset} />}
        </div>
        <fieldset disabled={!can.update} className="grid gap-6">
          <FieldGrid title="Noma'lum raqam">
            <Row label="Kiruvchi">{sel("incoming_unknown")}</Row>
            <Row label="O'tkazib yuborilgan">{sel("missed_unknown")}</Row>
            <Row label="Chiquvchi">{sel("outgoing_unknown")}</Row>
            <Row label="Ma'lum mijoz">
              <Select value={v.duplicate} onChange={(e) => form.set("duplicate", e.target.value as RuleValues["duplicate"])}>
                <option value="open_lead">Ochiq lidiga yozish (yo'q bo'lsa — yangi)</option>
                <option value="always_new">Har safar yangi lid</option>
                <option value="contact_only">Faqat mijozga bog'lash</option>
              </Select>
            </Row>
          </FieldGrid>
          <FieldGrid title="Yangi lid">
            <Row label="Voronka">
              <Select value={v.pipeline_id ?? ""} onChange={(e) => { form.set("pipeline_id", e.target.value ? Number(e.target.value) : null); form.set("stage_id", null); }}>
                <option value="">Asosiy voronka</option>
                {(pipelines.data ?? []).filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Row>
            <Row label="Bosqich">
              <Select value={v.stage_id ?? ""} onChange={(e) => form.set("stage_id", e.target.value ? Number(e.target.value) : null)}>
                <option value="">Birinchi bosqich</option>
                {(pipeline?.stages ?? []).filter((s) => !s.is_won && !s.is_lost).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Row>
            <Row label="Mas'ul">
              <Select value={v.responsible} onChange={(e) => form.set("responsible", e.target.value as RuleValues["responsible"])}>
                <option value="operator">Javob bergan xodim</option>
                <option value="contact_owner">Mijozning menejeri</option>
                <option value="fixed">Belgilangan xodim</option>
              </Select>
            </Row>
            {v.responsible === "fixed" && (
              <Row label="Xodim"><EntitySelect endpoint="employees" extraParams={{ status: "active" }} value={v.fixed_manager_id} onChange={(id) => form.set("fixed_manager_id", id)} /></Row>
            )}
            <Row label="Lid nomi"><Input {...form.text("lead_title")} /><span className="text-xs text-muted">{"{phone}"} — raqam o'rniga</span></Row>
            <Row label="Manba"><RefSelect kind="sales_channel" value={v.source_id} onChange={(x) => form.set("source_id", x)} /></Row>
            <Row label="Teglar"><TagsEditor value={v.tags} disabled={!can.update} onChange={(t) => form.set("tags", t)} /></Row>
          </FieldGrid>
          <FieldGrid title="Boshqa">
            <Row label="Qayta qo'ng'iroq"><Toggle label="O'tkazilgan qo'ng'iroqqa vazifa" checked={v.missed_task} disabled={!can.update} onChange={(x) => form.set("missed_task", x)} /></Row>
            <Row label="Vazifa muddati" error={form.errors.missed_task_minutes}><Input inputMode="numeric" className="w-24" {...form.text("missed_task_minutes")} /><span className="text-xs text-muted">daqiqadan keyin</span></Row>
            <Row label="Qalqib chiquvchi oyna"><Toggle label="Qo'ng'iroq kelganda ko'rsatish" checked={v.popup} disabled={!can.update} onChange={(x) => form.set("popup", x)} /></Row>
            <Row label="Qisqa suhbatlar" error={form.errors.min_duration}><Input inputMode="numeric" className="w-24" {...form.text("min_duration")} /><span className="text-xs text-muted">soniyadan qisqasi tarixga yozilmaydi</span></Row>
            <Row label="Telefoniya"><Toggle label="Yoqilgan (brauzer telefoni)" checked={v.enabled} disabled={!can.update} onChange={(x) => form.set("enabled", x)} /></Row>
          </FieldGrid>
        </fieldset>
      </Sheet>
    </form>
  );
}

// ------------------------------------------------------------------ extensions

function Extensions() {
  const can = useCan("telephony");
  const list = useExtensions();
  const remove = useDeleteExtension();
  const conns = useConnections();
  const [edit, setEdit] = useState<Extension | "new" | null>(null);
  const tel = (conns.data ?? []).filter((c) => c.group === "telephony");
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Har xodimning ichki raqami — qo'ng'iroqlar unga bog'lanadi. Moi Zvonki uchun raqam o'rniga xodimning Moi Zvonki emaili.</p>
        {can.update && <Button variant="soft" onClick={() => setEdit("new")}><Plus className="size-4" /> Qo'shish</Button>}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {list.data?.map((e) => (
          <div key={e.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
            <span className="w-40 truncate font-mono font-semibold">{e.number}</span>
            <span className="min-w-0 flex-1 truncate">{e.user.full_name}</span>
            {e.connection_id && <span className="text-xs text-muted">{tel.find((c) => c.id === e.connection_id)?.name}</span>}
            {e.softphone ? <Pill tone="ok">Brauzer telefoni</Pill> : <Pill>Faqat PBX</Pill>}
            {e.softphone && !e.has_password && <Pill tone="warn">SIP parol yo'q</Pill>}
            {can.update && <>
              <IconButton label="Tahrirlash" onClick={() => setEdit(e)}><Pencil className="size-4" strokeWidth={1.75} /></IconButton>
              <IconButton label="O'chirish" onClick={() => remove.mutate(e.id, { onError: notifyError })}><Trash2 className="size-4" strokeWidth={1.75} /></IconButton>
            </>}
          </div>
        ))}
        {!list.data?.length && <p className="px-3 py-5 text-center text-sm text-muted">Ichki raqam yo'q.</p>}
      </div>
      {edit && <ExtensionDialog ext={edit === "new" ? null : edit} conns={tel} onClose={() => setEdit(null)} />}
    </section>
  );
}

function ExtensionDialog({ ext, conns, onClose }: { ext: Extension | null; conns: { id: number; name: string; kind: string }[]; onClose: () => void }) {
  const save = useSaveExtension();
  const [v, setV] = useState<ExtensionInput>({
    user_id: ext?.user_id ?? null, number: ext?.number ?? "", connection_id: ext?.connection_id ?? conns[0]?.id ?? null,
    sip_login: ext?.sip_login ?? "", sip_password: "", softphone: ext?.softphone ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ExtensionInput>(k: K, x: ExtensionInput[K]) => setV((p) => ({ ...p, [k]: x }));
  const mz = conns.find((c) => c.id === v.connection_id)?.kind === "moizvonki";
  return (
    <Dialog open onClose={onClose} title={ext ? `Ichki raqam ${ext.number}` : "Yangi ichki raqam"}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={save.isPending} disabled={!v.user_id || !v.number.trim()}
          onClick={() => save.mutate({ id: ext?.id, data: v }, { onSuccess: () => { notifyOk("Saqlandi"); onClose(); }, onError: (e) => applyServerErrors({ setErrors }, e) })}>Saqlash</Button>
      </>}>
      <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Foydalanuvchi</span>
        <EntitySelect endpoint="users" current={ext ? { id: ext.user.id, full_name: ext.user.full_name } : null} value={v.user_id}
          error={errors.user_id} onChange={(id) => set("user_id", id)} />
      </label>
      {conns.length > 1 && (
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Ulanish</span>
          <Select value={v.connection_id ?? ""} onChange={(e) => set("connection_id", e.target.value ? Number(e.target.value) : null)}>
            {conns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </label>
      )}
      <label className="grid gap-1 text-sm"><span className="font-medium text-muted">{mz ? "Moi Zvonki email" : "Ichki raqam"}</span>
        <Input placeholder={mz ? "xodim@rombo.uz" : "101"} value={v.number} error={errors.number} onChange={(e) => set("number", e.target.value)} />
      </label>
      {mz ? (
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Xodimning Moi Zvonki API kaliti (click-to-call)</span>
          <Input type="password" autoComplete="new-password" placeholder={ext?.has_password ? "saqlangan — o'zgartirish uchun yozing" : "bo'sh — administrator kaliti"}
            value={v.sip_password} onChange={(e) => set("sip_password", e.target.value)} />
        </label>
      ) : (
        <>
          <Toggle label="Brauzer telefoni (qo'ng'iroqlar shu yerda)" checked={v.softphone} onChange={(x) => set("softphone", x)} />
          {v.softphone && <>
            <label className="grid gap-1 text-sm"><span className="font-medium text-muted">SIP login</span>
              <Input placeholder={v.number || "ichki raqam"} value={v.sip_login} onChange={(e) => set("sip_login", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm"><span className="font-medium text-muted">SIP parol</span>
              <Input type="password" autoComplete="new-password" placeholder={ext?.has_password ? "saqlangan — o'zgartirish uchun yozing" : ""}
                value={v.sip_password} onChange={(e) => set("sip_password", e.target.value)} />
            </label>
          </>}
        </>
      )}
    </Dialog>
  );
}

// ------------------------------------------------------------------ recordings → Google Drive

function Recordings() {
  const can = useCan("telephony");
  const st = useRecordings();
  const act = useRecordingsAction();
  const [sp] = useSearchParams();
  const google = sp.get("google");
  useEffect(() => {
    if (google === "connected") notifyOk("Google ulandi");
  }, [google]);
  const s = st.data;
  if (!s) return null;
  return (
    <div className="card grid gap-3 p-4">
      <p className="t-h2">Qo'ng'iroq yozuvlari Google Drive'da</p>
      <p className="text-sm text-muted">PBX yozuvlarni vaqtincha saqlaydi. Yoqilsa, har tugagan qo'ng'iroq yozuvi kompaniya Drive'idagi bitta papkaga nusxalanadi va shu yerdan eshitiladi.</p>
      {!s.configured && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Google ulanmagan: serverda GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET yo'q (backend/.env).</p>}
      {google === "cancelled" && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Google ulanishi bekor qilindi.</p>}
      {google === "error" && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">Google ulanmadi — Drive'ga ruxsat bering va qayta urinib ko'ring.</p>}
      {s.configured && !s.connected && can.update && (
        <Button className="w-fit" busy={act.isPending} onClick={() => act.mutate({ action: "connect", back: "/telephony/settings" }, {
          onSuccess: (r) => { if (r.url) window.location.href = r.url; }, onError: notifyError })}>Google'ni ulash</Button>
      )}
      {s.connected && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Akkaunt: <b>{s.email}</b></span>
            {can.update && <Toggle label="Yozuvlarni nusxalash" checked={s.enabled} onChange={(x) => act.mutate({ action: "switch", enabled: x }, { onError: notifyError })} />}
            {s.folder_url && <a href={s.folder_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">Papkani ochish <ExternalLink className="size-3.5" /></a>}
            {can.update && <Button variant="quiet" size="sm" className="ml-auto" onClick={() => act.mutate({ action: "disconnect" }, { onError: notifyError })}>Uzish</Button>}
          </div>
          {s.since && <p className="text-xs text-muted">{dayjs(s.since).format("DD.MM.YYYY HH:mm")} dan keyingi qo'ng'iroqlar nusxalanadi.</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Drive'da", s.archived, "text-ok"], ["Navbatda", s.pending, ""], ["Xato", s.failed, s.failed ? "text-bad" : ""], ["Yozuvli jami", s.with_recording, ""]].map(([l, n, tone]) => (
              <div key={l as string} className="rounded-xl border border-line p-3"><p className="text-xs text-muted">{l}</p><p className={`text-xl font-semibold tabular ${tone}`}>{n}</p></div>
            ))}
          </div>
          <p className="text-xs text-muted">Yozuv hali tayyor bo'lmasa 2, 10 va 30 daqiqadan keyin qayta uriniladi. Fon ishi: <code>manage.py crm_worker</code>.</p>
        </>
      )}
    </div>
  );
}
