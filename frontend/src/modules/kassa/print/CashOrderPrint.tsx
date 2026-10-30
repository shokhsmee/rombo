import { useParams } from "react-router-dom";

import { useCompany } from "@/modules/company/api";
import { d, n0, PrintFrame, RomboMark } from "@/modules/projects/print/PrintFrame";

import { ordersApi } from "../api";
import { unit } from "../labels";

/** PKO (КО-1) / RKO (КО-2) and the bank forms on paper. One A4 page: the order, then the tear-off receipt (kvitansiya) for a PKO. */
export function CashOrderPrint() {
  const { id } = useParams();
  const order = ordersApi.useDetail(id);
  const company = useCompany();
  const o = order.data;
  const c = company.data;
  if (!o || !c) return null;
  const isIn = o.kind === "in";
  const cash = o.account.kind === "cash";
  const formTitle = cash ? (isIn ? "KIRIM KASSA ORDERI" : "CHIQIM KASSA ORDERI") : (isIn ? "BANK KIRIMI" : "TO'LOV TOPSHIRIQNOMASI");
  const formCode = cash ? (isIn ? "KO-1" : "KO-2") : "";
  const who = isIn ? (o.received_from || o.partner?.name || o.employee?.name || "") : (o.issued_to || o.partner?.name || o.employee?.name || "");
  const cur = unit(o.currency);
  const cell = "border border-[#222] px-2 py-1 text-center";
  const sum = `${n0(o.amount)} ${cur}`;
  const words = o.currency === "UZS" ? `${n0(o.amount)} so'm 00 tiyin` : sum;

  const Body = ({ receipt }: { receipt?: boolean }) => (
    <div className={receipt ? "text-[11px]" : "text-[13px]"}>
      <table className="grid-table mt-2">
        <tbody>
          <tr>
            <td className="w-1/2 px-2 py-1 align-top">{isIn ? "Kimdan qabul qilindi" : "Kimga berildi"}: <b>{who || "____________________"}</b></td>
            <td className="px-2 py-1 align-top">Asos: {o.basis || (o.purpose?.name ?? "")}{o.project && ` · Loyiha ${o.project.code}`}</td>
          </tr>
          <tr>
            <td className="px-2 py-1" colSpan={2}>Summa: <b>{sum}</b> ({words})</td>
          </tr>
          {o.invoice && <tr><td className="px-2 py-1" colSpan={2}>Hisob-faktura: {o.invoice.code}</td></tr>}
          {o.currency !== "UZS" && o.rate && <tr><td className="px-2 py-1" colSpan={2}>Kurs: {n0(o.rate)} · {n0(o.amount_uzs)} so'm</td></tr>}
        </tbody>
      </table>
      {!receipt && (
        <table className="mt-3 text-[12px]">
          <thead>
            <tr><td className={cell}>Debet</td><td className={cell}>Kredit</td><td className={cell}>Summa</td><td className={cell}>Maqsad kodi</td></tr>
          </thead>
          <tbody>
            <tr>
              <td className={cell}>{isIn ? o.account.name : (o.purpose?.name ?? "")}</td>
              <td className={cell}>{isIn ? (o.purpose?.name ?? "") : o.account.name}</td>
              <td className={cell}>{sum}</td>
              <td className={cell}>{o.entry_code ?? ""}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <PrintFrame title={`${o.code} · ${who}`}>
      <div className="flex items-start justify-between text-[12px]">
        <div>
          <div className="mb-1"><RomboMark size={24} /></div>
          <p className="font-bold">{c.name}</p>
          <p>{c.address}{c.inn && ` · STIR ${c.inn}`}</p>
          {!cash && (o.account.name || c.bank_account) && <p>{c.bank_name} MFO {c.mfo} · x/r {c.bank_account}</p>}
        </div>
        {formCode && <p className="text-right text-[11px]">Shakl {formCode}</p>}
      </div>
      <h1 className="mt-4 text-center text-[18px] font-bold uppercase">{formTitle}</h1>
      <p className="text-center text-[13px]">№ <b>{o.code}</b> · {d(o.date)}</p>
      <Body />
      <table className="mt-8 text-[13px]">
        <tbody>
          <tr>
            <td className="w-1/2 pr-6 align-top">
              <p>Rahbar: {c.director_short || c.director || "_______________"}</p>
              <p className="mt-6">Bosh hisobchi: _______________</p>
            </td>
            <td className="w-1/2 pl-6 align-top">
              <p>{isIn ? "Qabul qildi" : "Berdi"} (kassir): {o.account.responsible?.name ?? "_______________"}</p>
              <p className="mt-6">{isIn ? "Topshirdi" : "Oldi"}: _______________</p>
            </td>
          </tr>
        </tbody>
      </table>
      {cash && isIn && (
        <>
          <div className="my-6 border-t border-dashed border-[#777]" />
          <p className="text-center text-[12px] font-bold uppercase">Kvitansiya — kirim kassa orderi № {o.code} · {d(o.date)}</p>
          <p className="text-center text-[11px]">{c.name}</p>
          <Body receipt />
          <p className="mt-4 text-[11px]">Kassir: {o.account.responsible?.name ?? "_______________"} &nbsp;&nbsp; M.O'.</p>
        </>
      )}
      <p className="mt-2 text-right font-sans text-[10px] text-[#777]">Rombo ERP · {o.code}{o.entry_code && ` · ${o.entry_code}`}</p>
    </PrintFrame>
  );
}
