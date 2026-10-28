import { Phone } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { useCompany } from "@/modules/company/api";

import { projectsApi, useCalc } from "../api";
import { d, n0, PrintFrame, RomboMark } from "./PrintFrame";

const num = (v: string) => {
  const x = Number(v);
  return Number.isInteger(x) ? String(x) : x.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
};

/** "Счет фактура" — same layout as the sales department's sheet. */
export function InvoicePrint() {
  const { id, calcId } = useParams();
  const project = projectsApi.useDetail(id);
  const calc = useCalc(Number(id), Number(calcId));
  const company = useCompany();
  const [zeros, setZeros] = useState(true);
  const p = project.data;
  const c = calc.data;
  if (!p || !c) return null;

  const lines = c.lines.filter((l) => zeros || Number(l.qty) > 0);
  const cur = p.currency === "UZS" ? "сўм" : p.currency;
  const bar = c.bar_length_m ? ` - ${Number(c.bar_length_m).toLocaleString("ru-RU")} m` : "";

  return (
    <PrintFrame title={`Hisob-kitob · ${p.code}`}>
      <label className="mb-3 flex items-center gap-2 font-sans text-xs text-[#555] print:hidden">
        <input type="checkbox" checked={zeros} onChange={(e) => setZeros(e.target.checked)} /> 0 qatorlarni ham ko'rsatish
      </label>
      <table className="grid-table text-[13px]">
        <tbody>
          <tr>
            <td colSpan={2} className="!border-r-0"><RomboMark /></td>
            <td colSpan={3} className="!border-x-0 text-center text-[24px] italic font-semibold">Счет фактура</td>
            <td className="!border-l-0 text-right whitespace-nowrap"><Phone className="mr-1 inline size-3.5" />{company.data?.phone}</td>
          </tr>
          <tr><td colSpan={6} className="text-center font-bold">{c.title}{bar}</td></tr>
          <tr className="text-center font-bold">
            <td className="w-8">№</td><td>Наименование</td><td className="w-20">Ед.изм.</td>
            <td className="w-20">Кол-во</td><td className="w-20">Цена</td><td className="w-24">Сумма</td>
          </tr>
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="text-right">{c.lines.indexOf(l) + 1}</td>
              <td className="font-semibold">{l.name}</td>
              <td>{l.unit}</td>
              <td className="text-center font-bold">{num(l.qty)}</td>
              <td className="text-center">{num(l.price)}</td>
              <td className="text-center">{n0(l.line_sum)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={2} className="italic">Дата: {d(c.calc_date)}</td>
            <td colSpan={3} className="text-right">Итоговая сумма:</td>
            <td className="text-center">{n0(c.total)} {c.currency === "USD" ? "$" : "сўм"}</td>
          </tr>
          {[
            ["Сумма сделки:", p.amount ? `${n0(p.amount)} ${cur}` : ""],
            ["Сумма аванса:", Number(p.advance_amount) ? `${n0(p.advance_amount)} ${cur}` : ""],
            ["Остаток:", p.debt_amount ? `${n0(p.debt_amount)} ${cur}` : ""],
            ["Дата получения аванса", d(p.advance_date)],
            ["Срок сдачи заказа:", d(p.deadline)],
            ["Заказчик:", p.client.name],
            ["Исполнитель:", p.manager?.name ?? ""],
          ].map(([k, v]) => (
            <tr key={k}><td colSpan={3} className="font-bold">{k}</td><td colSpan={3} className="text-center font-semibold">{v}</td></tr>
          ))}
          <tr><td colSpan={6} className="italic font-semibold">цена указана на дату предоставления комерческого предложения</td></tr>
        </tbody>
      </table>
      <p className="mt-2 text-right font-sans text-[10px] text-[#777]">{p.code} · Rombo ERP</p>
    </PrintFrame>
  );
}
