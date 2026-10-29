import dayjs from "dayjs";
import { Printer } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { Button, Empty, Input, Pill, Segmented, Select, Spinner } from "@/components/ui";
import { fmtDate } from "@/lib/format";

import { useAccountCard, useAccounts, useReconciliation, useTrialBalance } from "./api";
import { ENTRY_STATUS, money } from "./labels";

type Report = "trial" | "card" | "act";

const th = "px-3 py-2.5 font-medium";
const num = "whitespace-nowrap px-3 py-2 text-right tabular";

/** Hisobotlar: oborot-saldo vedomost, hisob kartochkasi, solishtirma dalolatnoma. Parameters live in the URL. */
export function ReportsPage() {
  const [sp, setSp] = useSearchParams();
  const report = (sp.get("r") as Report | null) ?? "trial";
  const from = sp.get("from") ?? dayjs().startOf("month").format("YYYY-MM-DD");
  const to = sp.get("to") ?? dayjs().format("YYYY-MM-DD");
  const set = (patch: Record<string, string | null>) =>
    setSp((prev) => { const n = new URLSearchParams(prev); for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); } return n; }, { replace: true });

  return (
    <>
      <PageHeader title="Hisobotlar" lede="Barchasi jurnaldagi o'tkazmalardan hisoblanadi — hech qaerda saqlangan qoldiq yo'q."
        action={<Segmented value={report} onChange={(r) => set({ r })} options={[{ value: "trial", label: "Oborot-saldo" }, { value: "card", label: "Hisob kartochkasi" }, { value: "act", label: "Solishtirma dalolatnoma" }]} />} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted">dan <Input type="date" className="w-40" value={from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="flex items-center gap-1.5 text-sm text-muted">gacha <Input type="date" className="w-40" value={to} onChange={(e) => set({ to: e.target.value })} /></label>
        {report === "card" && <AccountPicker value={sp.get("account")} onChange={(v) => set({ account: v })} />}
        {report === "card" && (
          <EntitySelect endpoint="clients" placeholder="Kontragent (ixtiyoriy)" className="w-56"
            value={sp.get("partner") ? Number(sp.get("partner")) : null} onChange={(id) => set({ partner: id ? String(id) : null })} />
        )}
        {report === "act" && (
          <EntitySelect endpoint="clients" placeholder="Kontragent" className="w-64"
            value={sp.get("partner") ? Number(sp.get("partner")) : null} onChange={(id) => set({ partner: id ? String(id) : null })} />
        )}
        {report === "act" && sp.get("partner") && (
          <Button variant="ghost" className="ml-auto" onClick={() => window.open(`/print/accounting/reconciliation?partner=${sp.get("partner")}&from=${from}&to=${to}`, "_blank")}>
            <Printer className="size-4" strokeWidth={1.75} /> Chop etish
          </Button>
        )}
      </div>
      {report === "trial" && <TrialBalance from={from} to={to} />}
      {report === "card" && <AccountCard account={sp.get("account") ? Number(sp.get("account")) : null} from={from} to={to} partner={sp.get("partner") ? Number(sp.get("partner")) : null} />}
      {report === "act" && <Reconciliation partner={sp.get("partner") ? Number(sp.get("partner")) : null} from={from} to={to} />}
    </>
  );
}

function AccountPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const accounts = useAccounts({ allow_posting: "true" });
  return (
    <Select className="w-80" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— hisobni tanlang —</option>
      {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
    </Select>
  );
}

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">{children}</div>
);

function TrialBalance({ from, to }: { from: string; to: string }) {
  const q = useTrialBalance({ from, to });
  if (!q.data) return <div className="grid place-items-center py-12 text-muted"><Spinner className="size-5" /></div>;
  const t = q.data.totals;
  if (!q.data.rows.length) return <Empty>Bu davrda o'tkazma yo'q.</Empty>;
  return (
    <Box>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th rowSpan={2} className={th}>Hisob</th>
            <th colSpan={2} className={`${th} border-l border-line text-center`}>Boshlang'ich qoldiq</th>
            <th colSpan={2} className={`${th} border-l border-line text-center`}>Davr oboroti</th>
            <th colSpan={2} className={`${th} border-l border-line text-center`}>Oxirgi qoldiq</th>
          </tr>
          <tr className="border-b border-line text-right text-xs uppercase tracking-wider text-muted">
            <th className={`${th} border-l border-line`}>Debet</th><th className={th}>Kredit</th>
            <th className={`${th} border-l border-line`}>Debet</th><th className={th}>Kredit</th>
            <th className={`${th} border-l border-line`}>Debet</th><th className={th}>Kredit</th>
          </tr>
        </thead>
        <tbody>
          {q.data.rows.map((r) => (
            <tr key={r.account.id} className="border-b border-line last:border-0 hover:bg-ground">
              <td className="whitespace-nowrap px-3 py-2"><Link to={`/accounting/reports?r=card&account=${r.account.id}&from=${from}&to=${to}`} className="hover:text-accent-ink"><b className="font-mono">{r.account.code}</b> <span className="text-muted">{r.account.name}</span></Link></td>
              <td className={`${num} border-l border-line`}>{money(r.open_dt, true)}</td><td className={num}>{money(r.open_kt, true)}</td>
              <td className={`${num} border-l border-line`}>{money(r.dt, true)}</td><td className={num}>{money(r.kt, true)}</td>
              <td className={`${num} border-l border-line font-medium`}>{money(r.close_dt, true)}</td><td className={`${num} font-medium`}>{money(r.close_kt, true)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-ground/60 font-semibold">
            <td className="px-3 py-2">Jami</td>
            <td className={`${num} border-l border-line`}>{money(t.open_dt)}</td><td className={num}>{money(t.open_kt)}</td>
            <td className={`${num} border-l border-line`}>{money(t.dt)}</td><td className={num}>{money(t.kt)}</td>
            <td className={`${num} border-l border-line`}>{money(t.close_dt)}</td><td className={num}>{money(t.close_kt)}</td>
          </tr>
        </tfoot>
      </table>
    </Box>
  );
}

function AccountCard({ account, from, to, partner }: { account: number | null; from: string; to: string; partner: number | null }) {
  const q = useAccountCard({ account, from, to, partner });
  if (!account) return <Empty>Hisobni tanlang.</Empty>;
  if (!q.data) return <div className="grid place-items-center py-12 text-muted"><Spinner className="size-5" /></div>;
  const d = q.data;
  return (
    <Box>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-3 py-2.5 text-sm">
        <span><b className="font-mono">{d.account.code}</b> {d.account.name}</span>
        <span className="text-muted">Boshlang'ich: <b className="tabular text-ink">{money(d.opening)}</b></span>
        <span className="text-muted">Oborot Dt <b className="tabular text-ink">{money(d.turnover_dt)}</b> · Kt <b className="tabular text-ink">{money(d.turnover_kt)}</b></span>
        <span className="text-muted">Oxirgi: <b className="tabular text-ink">{money(d.closing)}</b></span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th className={th}>Sana</th><th className={th}>O'tkazma</th><th className={th}>Mazmuni</th><th className={th}>Kontragent / Loyiha</th>
            <th className={`${th} text-right`}>Debet</th><th className={`${th} text-right`}>Kredit</th><th className={`${th} text-right`}>Qoldiq</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.id} className={`border-b border-line last:border-0 hover:bg-ground ${r.entry.status === "reversed" ? "opacity-60" : ""}`}>
              <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.date)}</td>
              <td className="whitespace-nowrap px-3 py-2"><Link to={`/accounting/entries/${r.entry.id}`} className="font-mono text-xs text-accent-ink hover:underline">{r.entry.code}</Link>{r.entry.status === "reversed" && <Pill tone={ENTRY_STATUS.reversed.tone}>storno</Pill>}</td>
              <td className="px-3 py-2">{r.memo}{r.currency !== "UZS" && <span className="ml-1 text-xs text-muted">({money(r.amount_cur)} {r.currency})</span>}</td>
              <td className="px-3 py-2 text-xs">{r.partner?.name}{r.partner && r.project && " · "}{r.project && <span className="font-mono">{r.project.code}</span>}</td>
              <td className={num}>{money(r.debit, true)}</td><td className={num}>{money(r.credit, true)}</td>
              <td className={`${num} font-medium`}>{money(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!d.rows.length && <p className="px-3 py-8 text-center text-sm text-muted">Bu davrda o'tkazma yo'q.</p>}
    </Box>
  );
}

function Reconciliation({ partner, from, to }: { partner: number | null; from: string; to: string }) {
  const q = useReconciliation({ partner, from, to });
  if (!partner) return <Empty>Kontragentni tanlang — dalolatnoma uning 4010 / 6310 / 6010 / 4310 hisoblaridan tuziladi.</Empty>;
  if (!q.data) return <div className="grid place-items-center py-12 text-muted"><Spinner className="size-5" /></div>;
  const d = q.data;
  const side = (v: string) => (Number(v) > 0 ? `${money(v)} — bizning foydamizga` : Number(v) < 0 ? `${money(-Number(v))} — kontragent foydasiga` : "0");
  return (
    <Box>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-3 py-2.5 text-sm">
        <span className="font-medium">{d.partner.name}</span>
        <span className="text-muted">Boshlang'ich: <b className="text-ink">{side(d.opening)}</b></span>
        <span className="text-muted">Oxirgi: <b className="text-ink">{side(d.closing)}</b></span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th className={th}>Sana</th><th className={th}>Hujjat</th><th className={th}>Mazmuni</th>
            <th className={`${th} text-right`}>Debet</th><th className={`${th} text-right`}>Kredit</th><th className={`${th} text-right`}>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.entry.id} className="border-b border-line last:border-0 hover:bg-ground">
              <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.date)}</td>
              <td className="whitespace-nowrap px-3 py-2"><Link to={`/accounting/entries/${r.entry.id}`} className="hover:text-accent-ink">{r.document}</Link></td>
              <td className="px-3 py-2 text-muted">{r.memo}{r.currency !== "UZS" && Number(r.amount_cur) !== 0 && <span className="ml-1 text-xs">({money(r.amount_cur)} {r.currency})</span>}</td>
              <td className={num}>{money(r.dt, true)}</td><td className={num}>{money(r.kt, true)}</td>
              <td className={`${num} font-medium`}>{money(r.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-ground/60 font-semibold">
            <td colSpan={3} className="px-3 py-2">Davr oboroti</td>
            <td className={num}>{money(d.turnover_dt)}</td><td className={num}>{money(d.turnover_kt)}</td><td className={num}>{money(d.closing)}</td>
          </tr>
        </tfoot>
      </table>
    </Box>
  );
}
