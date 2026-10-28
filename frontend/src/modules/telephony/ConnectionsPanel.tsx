// Connections (ported from uzbridge crm/Settings.tsx Connections + ConnectionModal): telephony providers and lead
// sources drawn from the backend catalog. Secrets are never shown back — only a masked hint that one is saved.
import dayjs from "dayjs";
import { ChevronDown, Copy, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { EntitySelect } from "@/components/EntitySelect";
import { Button, ConfirmDialog, Dialog, IconButton, Input, Pill, Select } from "@/components/ui";
import { notifyError, notifyOk } from "@/lib/notify";
import { usePipelines } from "@/modules/crm/api";

import {
  useCatalog, useConnectionAction, useConnections, useDeleteConnection, useSaveConnection,
  type CatalogField, type CatalogKind, type Connection,
} from "./api";

const STATUS: Record<Connection["status"], { label: string; tone: "neutral" | "ok" | "bad" }> = {
  new: { label: "yangi", tone: "neutral" }, ok: { label: "ishlayapti", tone: "ok" }, error: { label: "xato", tone: "bad" },
};

export function ConnectionsPanel({ group }: { group: "telephony" | "leads" }) {
  const catalog = useCatalog();
  const conns = useConnections();
  const [edit, setEdit] = useState<{ kind: CatalogKind; conn?: Connection } | null>(null);
  const kinds = (catalog.data ?? []).filter((k) => k.group === group);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {kinds.map((k) => {
        const mine = (conns.data ?? []).filter((c) => c.kind === k.kind);
        return (
          <div key={k.kind} className="card grid content-start gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div><p className="t-h2">{k.name}</p><p className="text-xs text-muted">{k.tagline}</p></div>
              <Button size="sm" variant={mine.length ? "ghost" : "primary"} onClick={() => setEdit({ kind: k })}>
                <Plus className="size-3.5" /> {mine.length ? "Yana" : "Ulash"}
              </Button>
            </div>
            {mine.map((c) => (
              <button key={c.id} type="button" onClick={() => setEdit({ kind: k, conn: c })}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-accent">
                <span className={`size-2 rounded-full ${!c.enabled ? "bg-faint" : c.status === "ok" ? "bg-ok" : c.status === "error" ? "bg-bad" : "bg-warn"}`} />
                <span className="flex-1 font-medium">{c.name}</span>
                <span className="text-xs text-muted">{c.events_count} hodisa</span>
                <Pill tone={c.enabled ? STATUS[c.status].tone : "neutral"}>{c.enabled ? STATUS[c.status].label : "o'chiq"}</Pill>
              </button>
            ))}
          </div>
        );
      })}
      {edit && <ConnectionModal kind={edit.kind} conn={edit.conn} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ConnectionModal({ kind, conn, onClose }: { kind: CatalogKind; conn?: Connection; onClose: () => void }) {
  const save = useSaveConnection();
  const remove = useDeleteConnection();
  const act = useConnectionAction();
  const [name, setName] = useState(conn?.name ?? kind.name);
  const [config, setConfig] = useState<Record<string, unknown>>(() =>
    ({ ...Object.fromEntries(kind.fields.filter((f) => !f.secret && f.default).map((f) => [f.key, f.default])), ...(conn?.config ?? {}) }));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [del, setDel] = useState(false);
  const c = conn;
  const mode = String(config.auth_mode ?? "bearer");
  const hidden = (f: CatalogField) =>
    (["api_key"].includes(f.key) && f.advanced && mode === "basic") || (["login", "password"].includes(f.key) && f.advanced && kind.kind !== "utel" && mode !== "basic");
  const basic = kind.fields.filter((f) => !f.advanced && !hidden(f));
  const extra = kind.fields.filter((f) => f.advanced && !hidden(f));
  const canSync = ["utel", "moizvonki", "amocrm"].includes(kind.kind) || !!config.history_path || !!config.leads_path;

  const submit = () => save.mutate({ id: c?.id, data: { kind: kind.kind, name, config, secrets: Object.fromEntries(Object.entries(secrets).filter(([, v]) => v)) } }, {
    onSuccess: () => { notifyOk("Saqlandi"); onClose(); }, onError: notifyError,
  });
  const run = (action: "check" | "sync" | "token") => c && act.mutate({ id: c.id, action, days: action === "sync" ? 3 : undefined }, {
    onSuccess: (r) => notifyOk(action === "check" ? `Ulanish ishlayapti${r.records !== undefined ? ` · ${r.records} ta yozuv` : ""}`
      : action === "sync" ? `Olindi: ${r.received ?? 0}, yangi: ${r.new ?? 0}` : "Yangi manzil berildi"),
    onError: notifyError,
  });

  return (
    <Dialog open onClose={onClose} title={c ? c.name : `${kind.name} ulash`} width="max-w-2xl"
      footer={<>
        {c && <Button variant="danger" className="mr-auto" onClick={() => setDel(true)}>O'chirish</Button>}
        {c && <Button variant="ghost" onClick={() => save.mutate({ id: c.id, data: { enabled: !c.enabled } }, { onSuccess: onClose, onError: notifyError })}>{c.enabled ? "O'chirib qo'yish" : "Yoqish"}</Button>}
        <Button busy={save.isPending} onClick={submit}>Saqlash</Button>
      </>}>
      {c && (
        <div className="grid gap-1 text-xs text-muted">
          <span>Hodisalar: <b className="text-ink">{c.events_count}</b>{c.last_event_at && <> · oxirgisi {dayjs(c.last_event_at).format("DD.MM HH:mm")}</>}{c.last_sync_at && <> · tarix {dayjs(c.last_sync_at).format("DD.MM HH:mm")}</>}</span>
          {c.last_error && <span className="rounded-md bg-bad-soft px-2 py-1 text-bad">{c.last_error}</span>}
        </div>
      )}
      <p className="text-sm text-muted">{kind.howto}</p>
      {c && (
        <div className="grid gap-1">
          <span className="text-sm font-medium text-muted">{kind.kind === "amocrm" ? "Redirect URI (amoCRM integratsiyasiga)" : "Webhook manzili"}</span>
          <div className="flex gap-2">
            <Input readOnly value={c.webhook_url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <IconButton label="Nusxa olish" onClick={() => { void navigator.clipboard?.writeText(c.webhook_url); notifyOk("Nusxa olindi"); }}><Copy className="size-4" /></IconButton>
            {kind.kind !== "amocrm" && <IconButton label="Yangi manzil" onClick={() => setRotate(true)}><RefreshCw className="size-4" /></IconButton>}
          </div>
          <span className="text-xs text-muted">Manzil — parol: uni faqat shu xizmatga bering.</span>
        </div>
      )}
      {c && (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" busy={act.isPending} onClick={() => run("check")}>Tekshirish</Button>
          {canSync && <Button variant="ghost" size="sm" busy={act.isPending} onClick={() => run("sync")}>Tarixni olish</Button>}
          {canSync && kind.group === "telephony" && <span className="self-center text-xs text-muted">Tarixdagi qo'ng'iroqlar lid va vazifa yaratmaydi — faqat bog'lanadi.</span>}
        </div>
      )}
      <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Nomi</span><Input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        {basic.map((f) => <FieldControl key={f.key} f={f} conn={c} config={config} secrets={secrets} setConfig={setConfig} setSecrets={setSecrets} />)}
      </div>
      {extra.length > 0 && (
        <>
          <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex items-center gap-1 text-sm text-accent-ink">
            <ChevronDown className={`size-4 transition ${advanced ? "rotate-180" : ""}`} /> Qo'shimcha sozlamalar
          </button>
          {advanced && (
            <div className="grid gap-3 sm:grid-cols-2">
              {extra.map((f) => <FieldControl key={f.key} f={f} conn={c} config={config} secrets={secrets} setConfig={setConfig} setSecrets={setSecrets} />)}
            </div>
          )}
        </>
      )}
      <ConfirmDialog open={rotate} onClose={() => setRotate(false)} title="Yangi webhook manzili" confirmLabel="Yangilash" busy={act.isPending}
        text="Eski manzil darhol ishlamay qoladi — xizmat sozlamasida yangisini qo'ying."
        onConfirm={() => { run("token"); setRotate(false); }} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} danger title="Ulanishni o'chirish" busy={remove.isPending}
        text="Webhook ishlamay qoladi. Qo'ng'iroqlar va lidlar qoladi." confirmLabel="O'chirish"
        onConfirm={() => c && remove.mutate(c.id, { onSuccess: onClose, onError: notifyError })} />
    </Dialog>
  );
}

function FieldControl({ f, conn, config, secrets, setConfig, setSecrets }: {
  f: CatalogField; conn?: Connection; config: Record<string, unknown>; secrets: Record<string, string>;
  setConfig: (fn: (c: Record<string, unknown>) => Record<string, unknown>) => void; setSecrets: (fn: (s: Record<string, string>) => Record<string, string>) => void;
}) {
  const pipelines = usePipelines();
  const v = config[f.key];
  const put = (x: unknown) => setConfig((c) => ({ ...c, [f.key]: x }));
  let control;
  if (f.secret) {
    const saved = conn?.secrets[f.key];
    control = <Input type="password" autoComplete="new-password" value={secrets[f.key] ?? ""} placeholder={saved ? `saqlangan ${saved} — almashtirish uchun yozing` : f.placeholder}
      onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))} />;
  } else if (f.type === "select") {
    control = <Select value={String(v ?? f.default ?? "")} onChange={(e) => put(e.target.value)}>{(f.options ?? []).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>;
  } else if (f.type === "pipeline") {
    control = <Select value={String(v ?? "")} onChange={(e) => put(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Asosiy voronka</option>
      {(pipelines.data ?? []).filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>;
  } else if (f.type === "stage") {
    const p = (pipelines.data ?? []).find((x) => x.id === Number(config.pipeline_id)) ?? (pipelines.data ?? []).find((x) => x.is_default);
    control = <Select value={String(v ?? "")} onChange={(e) => put(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Birinchi bosqich</option>
      {(p?.stages ?? []).filter((s) => !s.is_won && !s.is_lost).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </Select>;
  } else if (f.type === "user") {
    control = <EntitySelect endpoint="employees" extraParams={{ status: "active" }} value={v ? Number(v) : null} onChange={(id) => put(id)} />;
  } else {
    control = <Input type={f.type === "url" ? "url" : "text"} value={String(v ?? "")} placeholder={f.placeholder} onChange={(e) => put(e.target.value)} />;
  }
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-muted">{f.label}</span>
      {control}
      {f.help && <span className="text-xs text-faint">{f.help}</span>}
    </label>
  );
}

