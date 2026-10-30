import { useParams } from "react-router-dom";

import { useCompany } from "@/modules/company/api";
import { d, PrintFrame, RomboMark } from "@/modules/projects/print/PrintFrame";

import { ordersApi } from "../api";

const n = (v: string | number) => {
  const x = Number(v);
  // keep the decimal comma; only the no-break grouping space becomes a plain space
  return (Number.isInteger(x) ? x : Math.round(x * 100) / 100).toLocaleString("ru-RU").replace(/[  ]/g, " ");
};
const cur = (c: string) => (c === "UZS" ? "so'm" : c);

/** Buyurtma — the paper the supplier gets (same content as the email). */
export function OrderPrint() {
  const { id } = useParams();
  const order = ordersApi.useDetail(id);
  const company = useCompany();
  const o = order.data;
  const c = company.data;
  if (!o || !c) return null;
  const t = o.totals;

  return (
    <PrintFrame title={`Buyurtma · ${o.code}`}>
      <div className="flex items-start justify-between gap-4">
        <RomboMark />
        <div className="text-right text-[13px]">
          <div className="text-[22px] font-bold">Buyurtma № {o.code}</div>
          <div>Sana: {d(o.date)}{o.expected_date ? ` · Kutilayotgan sana: ${d(o.expected_date)}` : ""}</div>
        </div>
      </div>

      <table className="mt-4 text-[13px]">
        <tbody>
          <tr className="align-top">
            <td className="w-1/2 pr-4">
              <b>Buyurtmachi:</b> {c.legal_form} {c.name}<br />
              {c.address && <>{c.city} {c.address}<br /></>}
              {c.inn && <>STIR: {c.inn}<br /></>}
              {c.bank_account && <>X/R: {c.bank_account}, {c.bank_name}{c.mfo ? `, MFO ${c.mfo}` : ""}<br /></>}
              {c.phone && <>Tel: {c.phone}</>}
            </td>
            <td className="w-1/2">
              <b>Yetkazib beruvchi:</b> {o.supplier.name}<br />
              {o.project && <>Loyiha: {o.project.code} · {o.project.name}<br /></>}
              {o.sent_to && <>Yuborildi: {o.sent_to}</>}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="grid-table mt-4 text-[13px]">
        <thead>
          <tr className="text-center font-bold">
            <td className="w-8">№</td><td>Nomi</td><td className="w-16">Birlik</td><td className="w-20">Miqdor</td>
            <td className="w-24">Narx, {cur(o.currency)}</td><td className="w-16">QQS %</td><td className="w-28">Summa, {cur(o.currency)}</td>
          </tr>
        </thead>
        <tbody>
          {o.lines.map((l, i) => (
            <tr key={l.id}>
              <td className="text-right">{i + 1}</td>
              <td className="font-semibold">{l.name}</td>
              <td className="text-center">{l.unit}</td>
              <td className="text-right">{n(l.qty)}</td>
              <td className="text-right">{n(l.price)}</td>
              <td className="text-right">{n(l.vat_rate)}</td>
              <td className="text-right">{n(l.gross)}</td>
            </tr>
          ))}
          <tr><td colSpan={6} className="text-right">Summa (QQSsiz):</td><td className="text-right">{n(t.net)}</td></tr>
          <tr><td colSpan={6} className="text-right">QQS:</td><td className="text-right">{n(t.vat)}</td></tr>
          <tr className="font-bold"><td colSpan={6} className="text-right">Jami:</td><td className="text-right">{n(t.gross)} {cur(o.currency)}</td></tr>
          {o.currency !== "UZS" && o.rate && (
            <tr><td colSpan={6} className="text-right italic">Kurs {n(o.rate)} bo'yicha, so'm:</td><td className="text-right">{n(t.gross_uzs)}</td></tr>
          )}
        </tbody>
      </table>

      {o.notes && <p className="mt-3 text-[13px]"><b>Izoh:</b> {o.notes}</p>}

      <table className="mt-10 text-[13px]">
        <tbody>
          <tr>
            <td className="w-1/2">Buyurtmachi: ______________________ {c.director_short}</td>
            <td className="w-1/2">Yetkazib beruvchi: ______________________</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-right font-sans text-[10px] text-[#777]">{o.code} · Rombo ERP</p>
    </PrintFrame>
  );
}
