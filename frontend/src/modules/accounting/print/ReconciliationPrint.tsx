import { useSearchParams } from "react-router-dom";

import { useCompany } from "@/modules/company/api";
import { d, n0, PrintFrame, RomboMark } from "@/modules/projects/print/PrintFrame";

import { useReconciliation } from "../api";

/** Solishtirma dalolatnoma (акт сверки) — the two-column form suppliers exchange, from Rombo's side. */
export function ReconciliationPrint() {
  const [sp] = useSearchParams();
  const partner = sp.get("partner") ? Number(sp.get("partner")) : null;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const act = useReconciliation({ partner, from, to });
  const company = useCompany();
  const a = act.data;
  const c = company.data;
  if (!a || !c) return null;

  const who = (v: string) => (Number(v) >= 0 ? `${c.name} foydasiga` : `${a.partner.name} foydasiga`);
  const abs = (v: string) => n0(Math.abs(Number(v)));
  const cell = "border border-[#222] px-1.5 py-0.5";

  return (
    <PrintFrame title={`Solishtirma dalolatnoma · ${a.partner.name}`}>
      <div className="mb-3 border-b border-[#222] pb-2"><RomboMark size={30} /></div>
      <h1 className="text-center text-[18px] font-bold uppercase">Solishtirma dalolatnoma</h1>
      <p className="text-center text-[13px]">
        {c.name}{c.inn && ` (STIR ${c.inn})`} va {a.partner.name}{a.partner.tin && ` (STIR ${a.partner.tin})`} o'rtasidagi
        o'zaro hisob-kitoblar bo'yicha, {d(a.from)} — {d(a.to)} davri uchun
      </p>
      <table className="mt-4 text-[12px]">
        <thead>
          <tr className="text-center font-bold">
            <td className={cell} rowSpan={2}>Sana</td>
            <td className={cell} rowSpan={2}>Hujjat</td>
            <td className={cell} colSpan={2}>{c.name} ma'lumotlari, so'm</td>
            <td className={cell} colSpan={2}>{a.partner.name} ma'lumotlari, so'm</td>
          </tr>
          <tr className="text-center font-bold">
            <td className={cell}>Debet</td><td className={cell}>Kredit</td><td className={cell}>Debet</td><td className={cell}>Kredit</td>
          </tr>
        </thead>
        <tbody>
          <tr className="font-semibold">
            <td className={cell} colSpan={2}>Davr boshiga saldo</td>
            <td className={`${cell} text-right`}>{Number(a.opening) > 0 ? abs(a.opening) : ""}</td>
            <td className={`${cell} text-right`}>{Number(a.opening) < 0 ? abs(a.opening) : ""}</td>
            <td className={cell} /><td className={cell} />
          </tr>
          {a.rows.map((r) => (
            <tr key={r.entry.id}>
              <td className={`${cell} whitespace-nowrap`}>{d(r.date)}</td>
              <td className={cell}>{r.document}{r.memo && r.memo !== r.document ? ` — ${r.memo}` : ""}{r.currency !== "UZS" && Number(r.amount_cur) !== 0 ? ` (${n0(Math.abs(Number(r.amount_cur)))} ${r.currency})` : ""}</td>
              <td className={`${cell} text-right`}>{Number(r.dt) ? n0(r.dt) : ""}</td>
              <td className={`${cell} text-right`}>{Number(r.kt) ? n0(r.kt) : ""}</td>
              <td className={cell} /><td className={cell} />
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={cell} colSpan={2}>Davr oboroti</td>
            <td className={`${cell} text-right`}>{n0(a.turnover_dt)}</td>
            <td className={`${cell} text-right`}>{n0(a.turnover_kt)}</td>
            <td className={cell} /><td className={cell} />
          </tr>
          <tr className="font-bold">
            <td className={cell} colSpan={2}>Davr oxiriga saldo</td>
            <td className={`${cell} text-right`}>{Number(a.closing) > 0 ? abs(a.closing) : ""}</td>
            <td className={`${cell} text-right`}>{Number(a.closing) < 0 ? abs(a.closing) : ""}</td>
            <td className={cell} /><td className={cell} />
          </tr>
        </tbody>
      </table>
      <p className="mt-4 text-[13px]">
        {c.name} ma'lumotlariga ko'ra {d(a.to)} holatiga saldo: <b>{Number(a.closing) === 0 ? "0 so'm" : `${abs(a.closing)} so'm ${who(a.closing)}`}</b>.
      </p>
      <table className="mt-10 text-[13px]">
        <tbody>
          <tr>
            <td className="w-1/2 pr-6 align-top">
              <p className="font-bold">{c.name}</p>
              <p>{c.director_short || c.director ? `Direktor ${c.director_short || c.director}` : "Direktor"}</p>
              <p className="mt-8">_______________ / M.O'.</p>
            </td>
            <td className="w-1/2 pl-6 align-top">
              <p className="font-bold">{a.partner.name}</p>
              <p>Rahbar</p>
              <p className="mt-8">_______________ / M.O'.</p>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-right font-sans text-[10px] text-[#777]">Rombo ERP · {d(a.from)}–{d(a.to)}</p>
    </PrintFrame>
  );
}
