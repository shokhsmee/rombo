// Telefoniya → Sozlamalar: the PBX connection (webhook URL, SIP WebSocket), the CRM rules, users' extensions.
import dayjs from "dayjs";
import { Copy, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, FieldGrid, RecordNav, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { Button, ConfirmDialog, Dialog, IconButton, Input, Pill, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { notifyError, notifyOk } from "@/lib/notify";

import {
  useDeleteExtension, useExtensions, useRotateToken, useSaveExtension, useSaveTelephonySettings, useTelephonySettings,
  type Extension, type ExtensionInput, type TelephonySettings,
} from "./api";

type Values = Omit<TelephonySettings, "webhook_token" | "last_event_at" | "missed_task_minutes"> & { missed_task_minutes: string };

const EMPTY: Values = {
  enabled: true, sip_wss: "", sip_domain: "", company_numbers: "", incoming_creates_lead: true, missed_creates_lead: true,
  missed_task: true, missed_task_minutes: "15",
};

export function TelephonySettingsPage() {
  const can = useCan("telephony");
  const settings = useTelephonySettings();
  const save = useSaveTelephonySettings();
  const rotate = useRotateToken();
  const [rotateOpen, setRotateOpen] = useState(false);
  const st = settings.data;
  const form = useServerForm<Values, TelephonySettings>({
    initial: EMPTY,
    record: st,
    toForm: (r) => ({
      enabled: r.enabled, sip_wss: r.sip_wss, sip_domain: r.sip_domain, company_numbers: r.company_numbers,
      incoming_creates_lead: r.incoming_creates_lead, missed_creates_lead: r.missed_creates_lead, missed_task: r.missed_task,
      missed_task_minutes: String(r.missed_task_minutes),
    }),
    validate: {
      sip_wss: (v) => (!v || /^wss?:\/\//.test(v) ? null : "wss:// bilan boshlanadi"),
      missed_task_minutes: (v) => (/^\d+$/.test(v) && Number(v) >= 1 ? null : "Daqiqa soni"),
    },
  });
  const v = form.values;
  const hook = st?.webhook_token ? `${window.location.origin}/api/v1/telephony/hook/${st.webhook_token}/` : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    save.mutate({ ...v, missed_task_minutes: Number(v.missed_task_minutes) }, {
      onSuccess: () => { notifyOk("Saqlandi"); form.commit(); },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!st) return null;
  return (
    <div className="grid gap-3">
      <form onSubmit={submit} className="grid gap-3">
        <RecordNav listTo="/telephony" listLabel="Qo'ng'iroqlar" crumb="Sozlamalar" navKey="telephony" />
        <ActionBar right={<Pill tone={st.last_event_at ? "ok" : "neutral"}>{st.last_event_at ? `PBX oxirgi xabar: ${dayjs(st.last_event_at).format("DD.MM HH:mm")}` : "PBX hali xabar yubormagan"}</Pill>}>
          {can.update && <SaveButtons dirty={form.dirty} saving={save.isPending} onReset={form.reset} />}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow="Telefoniya" title="Sozlamalar" />
          <fieldset disabled={!can.update} className="grid gap-6">
            <FieldGrid title="PBX ulanishi">
              <Row label="Telefoniya"><Toggle label="Yoqilgan" checked={v.enabled} disabled={!can.update} onChange={(x) => form.set("enabled", x)} /></Row>
              <Row label="Kompaniya raqamlari"><Input placeholder="+998 66 200 00 00, …" {...form.text("company_numbers")} /></Row>
              <Row label="Webhook manzili" wide>
                <div className="flex gap-2">
                  <Input readOnly value={hook || "— ko'rish uchun tahrirlash ruxsati kerak"} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                  {hook && <IconButton label="Nusxa olish" onClick={() => { void navigator.clipboard?.writeText(hook); notifyOk("Nusxa olindi"); }}><Copy className="size-4" /></IconButton>}
                  {can.update && <IconButton label="Yangi manzil" onClick={() => setRotateOpen(true)}><RefreshCw className="size-4" /></IconButton>}
                </div>
                <span className="text-xs text-muted">PBX qo'ng'iroq hodisalarini (ringing / answer / hangup) shu manzilga POST qiladi. Manzil — parol: hech kimga bermang.</span>
              </Row>
            </FieldGrid>
            <FieldGrid title="Brauzer telefoni (WebRTC)">
              <Row label="SIP WebSocket" error={form.errors.sip_wss}><Input placeholder="wss://pbx.rombo.uz:8089/ws" {...form.text("sip_wss")} /></Row>
              <Row label="SIP domen"><Input placeholder="pbx.rombo.uz (bo'sh — manzildan)" {...form.text("sip_domain")} /></Row>
            </FieldGrid>
            <FieldGrid title="CRM qoidalari">
              <Row label="Noma'lum raqam"><Toggle label="Kiruvchi qo'ng'iroqdan lid yaratish" checked={v.incoming_creates_lead} disabled={!can.update} onChange={(x) => form.set("incoming_creates_lead", x)} /></Row>
              <Row label="O'tkazib yuborilgan"><Toggle label="Noma'lum raqamdan lid yaratish" checked={v.missed_creates_lead} disabled={!can.update} onChange={(x) => form.set("missed_creates_lead", x)} /></Row>
              <Row label="Qayta qo'ng'iroq"><Toggle label="Vazifa qo'yish" checked={v.missed_task} disabled={!can.update} onChange={(x) => form.set("missed_task", x)} /></Row>
              <Row label="Vazifa muddati" error={form.errors.missed_task_minutes}><Input inputMode="numeric" className="w-24" {...form.text("missed_task_minutes")} /><span className="text-xs text-muted">daqiqadan keyin</span></Row>
            </FieldGrid>
          </fieldset>
        </Sheet>
      </form>
      <Extensions canEdit={can.update} />
      <ConfirmDialog open={rotateOpen} onClose={() => setRotateOpen(false)} title="Yangi webhook manzili"
        text="Eski manzil darhol ishlamay qoladi — PBX sozlamasida yangisini qo'yish kerak bo'ladi." confirmLabel="Yangilash" busy={rotate.isPending}
        onConfirm={() => rotate.mutate(undefined, { onSuccess: () => notifyOk("Yangi manzil berildi"), onError: notifyError })} />
    </div>
  );
}

function Extensions({ canEdit }: { canEdit: boolean }) {
  const list = useExtensions();
  const remove = useDeleteExtension();
  const [edit, setEdit] = useState<Extension | "new" | null>(null);
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="t-h2">Ichki raqamlar <span className="text-sm font-normal text-muted">{list.data?.length ?? 0}</span></h2>
        {canEdit && <Button variant="soft" onClick={() => setEdit("new")}><Plus className="size-4" /> Qo'shish</Button>}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {list.data?.map((e) => (
          <div key={e.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
            <span className="w-14 font-mono font-semibold">{e.number}</span>
            <span className="min-w-0 flex-1 truncate">{e.user.full_name}</span>
            {e.softphone ? <Pill tone="ok">Brauzer telefoni</Pill> : <Pill>Faqat PBX</Pill>}
            {e.softphone && !e.has_password && <Pill tone="warn">SIP parol yo'q</Pill>}
            {canEdit && <>
              <IconButton label="Tahrirlash" onClick={() => setEdit(e)}><Pencil className="size-4" strokeWidth={1.75} /></IconButton>
              <IconButton label="O'chirish" onClick={() => remove.mutate(e.id, { onError: notifyError })}><Trash2 className="size-4" strokeWidth={1.75} /></IconButton>
            </>}
          </div>
        ))}
        {!list.data?.length && <p className="px-3 py-5 text-center text-sm text-muted">Ichki raqam yo'q. Xodimga raqam bering — qo'ng'iroqlar unga bog'lanadi.</p>}
      </div>
      {edit && <ExtensionDialog ext={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function ExtensionDialog({ ext, onClose }: { ext: Extension | null; onClose: () => void }) {
  const save = useSaveExtension();
  const [v, setV] = useState<ExtensionInput>({
    user_id: ext?.user_id ?? null, number: ext?.number ?? "", sip_login: ext?.sip_login ?? "", sip_password: "", softphone: ext?.softphone ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ExtensionInput>(k: K, x: ExtensionInput[K]) => setV((p) => ({ ...p, [k]: x }));
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
      <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Ichki raqam</span>
        <Input placeholder="101" value={v.number} error={errors.number} onChange={(e) => set("number", e.target.value)} />
      </label>
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
    </Dialog>
  );
}
