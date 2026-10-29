import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { Button, Empty, Input, Select, Spinner } from "@/components/ui";
import { money } from "@/modules/accounting/labels";

import { useCashAccounts, useCashBook } from "./api";
import { unit } from "./labels";

const th = "px-3 py-2.5 font-medium";
const num = "whitespace-nowrap px-3 py-2 text-right tabular";

/** Kassa kitobi: one account, one day — opening, every posted order, totals, closing. Printable. */
export function CashBookPage() {
  const [sp, setSp] = useSearchParams();
  const accounts = useCashAccounts({ is_active: "true" });
  const account = sp.get("account") ? Number(sp.get("account")) : accounts.data?.[0]?.id ?? null;
  const date = sp.get("date") ?? dayjs().format("YYYY-MM-DD");
  const set = (patch: Record<string, string | null>) =>
    setSp((prev) => { const n = new URLSearchParams(prev); for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); } return n; }, { replace: true });
  const book = useCashBook({ account, date });
  const b = book.data;
  const shift = (days: number) => set({ date: dayjs(date).add(days, "day").format("YYYY-MM-DD") });

  return (
    <>
      <PageHeader title="Kassa kitobi" lede="Kun bo'yicha: kun boshiga qoldiq, kirim va chiqim orderlari, kun oxiriga qoldiq — hammasi jurnaldan."
        action={<Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" strokeWidth={1.75} /> Chop etish</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <Select className="w-56" value={account ?? ""} onChange={(e) => set({ account: e.target.value || null })}>
          {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <button type="button" onClick={() => shift(-1)} aria-label="Oldingi kun" className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted hover:text-ink"><ChevronLeft className="size-4" /></button>
        <Input type="date" className="w-40" value={date} onChange={(e) => set({ date: e.target.value })} />
        <button type="button" onClick={() => shift(1)} aria-label="Keyingi kun" className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted hover:text-ink"><ChevronRight className="size-4" /></button>
        <Button variant="quiet" size="sm" onClick={() => set({ date: dayjs().format("YYYY-MM-DD") })}>Bugun</Button>
      </div>
      {!account && accounts.data && <Empty>Faol kassa yo'q.</Empty>}
      {account && !b && <div className="grid place-items-center py-12 text-muted"><Spinner className="size-5" /></div>}
      {b && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-3 py-2.5 text-sm">
            <span className="font-medium">{b.account.name}</span>
            <span className="text-muted">{dayjs(b.date).format("DD.MM.YYYY")}</span>
            {b.account.responsible && <span className="text-muted">Kassir: {b.account.responsible}</span>}
            <span className="text-muted">Kun boshiga: <b className="tabular text-ink">{money(b.opening)}</b></span>
            <span className="text-muted">Kun oxiriga: <b className={`tabular ${b.over_limit ? "text-warn" : "text-ink"}`}>{money(b.closing)} {unit(b.account.currency)}</b></span>
            {b.over_limit && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">Limitdan oshdi ({money(b.account.cash_limit)})</span>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className={th}>№</th><th className={th}>Kimdan / kimga</th><th className={th}>Maqsad · asos</th>
                <th className={`${th} text-right`}>Kirim</th><th className={`${th} text-right`}>Chiqim</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line bg-ground/40 font-medium">
                <td className="px-3 py-2" colSpan={3}>Kun boshiga qoldiq</td>
                <td className={num} colSpan={2}>{money(b.opening)}</td>
              </tr>
              {b.rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-ground">
                  <td className="whitespace-nowrap px-3 py-2"><Link to={`/kassa/orders/${r.id}`} className="font-mono text-xs text-accent-ink hover:underline">{r.code}</Link></td>
                  <td className="px-3 py-2">{r.partner?.name ?? r.employee?.name ?? <span className="text-muted">—</span>}{r.project && <span className="ml-1 font-mono text-xs text-muted">{r.project.code}</span>}</td>
                  <td className="px-3 py-2 text-muted">{r.purpose}{r.basis && <> · {r.basis}</>}</td>
                  <td className={`${num} text-ok`}>{money(r.in, true)}</td>
                  <td className={`${num} text-bad`}>{money(r.out, true)}</td>
                </tr>
              ))}
              {!b.rows.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">Bu kunda order yo'q.</td></tr>}
              {Number(b.other) !== 0 && (
                <tr className="border-b border-line text-muted">
                  <td className="px-3 py-2" colSpan={3}>Boshqa o'tkazmalar (buxgalteriya: boshlang'ich qoldiq, tuzatish)</td>
                  <td className={num}>{Number(b.other) > 0 ? money(b.other) : ""}</td>
                  <td className={num}>{Number(b.other) < 0 ? money(-Number(b.other)) : ""}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-ground/60 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Kun bo'yicha jami</td>
                <td className={num}>{money(b.total_in)}</td><td className={num}>{money(b.total_out)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="px-3 py-2" colSpan={3}>Kun oxiriga qoldiq</td>
                <td className={num} colSpan={2}>{money(b.closing)} {unit(b.account.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
