import { Copy, KeyRound, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useCan } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Button, ConfirmDialog, Dialog, Empty, Field, IconButton, Input, Pill, Segmented, Select } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { PAGE_MCP } from "@/modules/specs/labels";

import { useIssueToken, useMcpInfo, useRevokeToken, useTokens, type IssuedToken, type McpToken, type TokenScope } from "./api";

type Client = "web" | "code" | "other";

const copy = (text: string) => {
  void navigator.clipboard?.writeText(text);
  notifyOk("Nusxa olindi");
};

function CopyLine({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-start gap-2 rounded-lg border border-line bg-ground px-3 py-2">
        <code className={`min-w-0 flex-1 font-mono text-xs break-all ${secret ? "text-ink" : "text-muted"}`}>{value}</code>
        <IconButton label="Nusxa olish" onClick={() => copy(value)}><Copy className="size-3.5" strokeWidth={1.75} /></IconButton>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-sm">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">{n}</span>
      <div className="min-w-0 pt-0.5">{children}</div>
    </li>
  );
}

const claudeCodeCmd = (endpoint: string, token: string) =>
  `claude mcp add --transport http rombo ${endpoint} --header "Authorization: Bearer ${token}"`;

/** How to connect, for the chosen client. With an issued token the values are real; otherwise placeholders. */
function Instructions({ client, endpoint, issued }: { client: Client; endpoint: string; issued?: IssuedToken }) {
  const token = issued?.token ?? "rmb_…";
  if (client === "web") {
    return (
      <ol className="grid gap-3">
        <Step n={1}>claude.ai yoki Claude Desktop → <b>Settings → Connectors → Add custom connector</b>.</Step>
        <Step n={2}>Nomi: <b>Rombo ERP</b>. URL: quyidagi <b>ulanish havolasi</b> (token ichida).</Step>
        <Step n={3}>Chatda vositalar menyusidan <b>Rombo ERP</b> ni yoqing va so'rang: «Ochiq servis arizalari qaysilar?»</Step>
        {issued && <CopyLine label="Ulanish havolasi (maxfiy)" value={issued.connector_url} secret />}
      </ol>
    );
  }
  if (client === "code") {
    return (
      <ol className="grid gap-3">
        <Step n={1}>Terminalda bir marta bajaring:</Step>
        <CopyLine label="Claude Code" value={claudeCodeCmd(endpoint, token)} secret={!!issued} />
        <Step n={2}><code className="font-mono text-xs">/mcp</code> buyrug'ida <b>rombo</b> ulanganini tekshiring.</Step>
      </ol>
    );
  }
  return (
    <ol className="grid gap-3">
      <Step n={1}>MCP Streamable HTTP, POST, JSON javob (SSE yo'q).</Step>
      <CopyLine label="Endpoint" value={endpoint} />
      <CopyLine label="Sarlavha" value={`Authorization: Bearer ${token}`} secret={!!issued} />
    </ol>
  );
}

export function McpPage() {
  const can = useCan(PAGE_MCP);
  const tokens = useTokens();
  const info = useMcpInfo();
  const revoke = useRevokeToken();
  const [client, setClient] = useState<Client>("web");
  const [createOpen, setCreateOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [toRevoke, setToRevoke] = useState<McpToken | null>(null);
  const endpoint = info.data?.endpoint ?? `${window.location.origin}/api/v1/mcp/`;
  const items = tokens.data?.items ?? [];

  return (
    <>
      <PageHeader title="Claude bilan ulash"
        lede="Claude sizning nomingizdan va faqat sizning ruxsatlaringiz bilan ishlaydi: ma'lumotni o'qiydi, siz tasdiqlasangiz amal bajaradi, spetsifikatsiyani tekshirib taklif yozadi."
        action={can.create && (
          <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" strokeWidth={1.75} /> Yangi token</Button>
        )} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="grid content-start gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="t-h2">Qanday ulanadi</h2>
            <Segmented size="sm" value={client} onChange={setClient}
              options={[{ value: "web", label: "claude.ai / Desktop" }, { value: "code", label: "Claude Code" }, { value: "other", label: "Boshqa" }]} />
          </div>
          <Instructions client={client} endpoint={endpoint} />
          <p className="flex gap-2 rounded-lg bg-ground px-3 py-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok" strokeWidth={1.75} />
            «Faqat o'qish» token ma'lumotni o'zgartirmaydi. «O'qish va yozish» tokeni bilan Claude har bir amaldan oldin sizdan so'raydi.
          </p>
        </section>

        <section className="grid content-start gap-3 rounded-xl border border-line bg-surface p-5">
          <h2 className="t-h2">Mening tokenlarim</h2>
          {items.length === 0 ? (
            <Empty>{tokens.isLoading ? "Yuklanmoqda…" : "Token yo'q. «Yangi token» bilan yarating."}</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <KeyRound className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Pill tone={t.scope === "write" ? "warn" : "info"}>{t.scope === "write" ? "O'qish va yozish" : "Faqat o'qish"}</Pill>
                      {t.is_expired && <Pill tone="bad">Muddati o'tgan</Pill>}
                    </div>
                    <div className="text-2xs text-muted">
                      <span className="font-mono">{t.prefix}…</span> · yaratildi {fmtDate(t.created_at)}
                      {t.expires_at && <> · {fmtDate(t.expires_at)} gacha</>}
                      {" · "}{t.last_used_at ? `oxirgi marta ${fmtDateTime(t.last_used_at)}` : "ishlatilmagan"}
                    </div>
                  </div>
                  {can.delete && (
                    <IconButton label="O'chirish" onClick={() => setToRevoke(t)}><Trash2 className="size-4" strokeWidth={1.75} /></IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {createOpen && (
        <CreateDialog onClose={() => setCreateOpen(false)} onIssued={(t) => { setCreateOpen(false); setIssued(t); }} />
      )}
      {issued && (
        <Dialog open onClose={() => setIssued(null)} title="Token tayyor" width="max-w-xl"
          footer={<Button onClick={() => setIssued(null)}>Saqladim</Button>}>
          <p className="flex gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            Token faqat hozir ko'rsatiladi. Uni hech kimga bermang — kim bilsa, sizning nomingizdan ishlaydi.
          </p>
          <CopyLine label="Token" value={issued.token} secret />
          <Segmented size="sm" value={client} onChange={setClient}
            options={[{ value: "web", label: "claude.ai / Desktop" }, { value: "code", label: "Claude Code" }, { value: "other", label: "Boshqa" }]} />
          <Instructions client={client} endpoint={issued.endpoint} issued={issued} />
        </Dialog>
      )}
      <ConfirmDialog open={!!toRevoke} onClose={() => setToRevoke(null)} danger busy={revoke.isPending}
        title="Tokenni o'chirish" confirmLabel="O'chirish"
        text={`«${toRevoke?.name}» bilan ulangan Claude darhol ishlamay qoladi.`}
        onConfirm={() => toRevoke && revoke.mutate(toRevoke.id, {
          onSuccess: () => { setToRevoke(null); notifyOk("Token o'chirildi"); },
          onError: notifyError,
        })} />
    </>
  );
}

function CreateDialog({ onClose, onIssued }: { onClose: () => void; onIssued: (t: IssuedToken) => void }) {
  const issue = useIssueToken();
  const [name, setName] = useState("Claude");
  const [scope, setScope] = useState<TokenScope>("read");
  const [days, setDays] = useState("90");
  const run = () => issue.mutate(
    { name: name.trim(), scope, expires_days: days ? Number(days) : null },
    { onSuccess: onIssued, onError: notifyError },
  );
  return (
    <Dialog open onClose={onClose} title="Yangi token"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button disabled={!name.trim()} busy={issue.isPending} onClick={run}>Yaratish</Button>
      </>}>
      <Field label="Nomi" hint="Qaysi qurilma yoki ilova uchun: «Ish noutbuki», «Claude telefon»">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Ruxsat">
        <Segmented value={scope} onChange={setScope}
          options={[{ value: "read", label: "Faqat o'qish" }, { value: "write", label: "O'qish va yozish" }]} />
      </Field>
      <Field label="Muddati">
        <Select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="30">30 kun</option>
          <option value="90">90 kun</option>
          <option value="365">1 yil</option>
          <option value="">Muddatsiz</option>
        </Select>
      </Field>
    </Dialog>
  );
}
