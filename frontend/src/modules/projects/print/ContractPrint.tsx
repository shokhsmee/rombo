import type { ReactNode } from "react";
import { useParams } from "react-router-dom";

import { useCompany } from "@/modules/company/api";

import { projectsApi } from "../api";
import { d, n0, PrintFrame } from "./PrintFrame";

const blank = (v: string | null | undefined, w = "_______________") => (v && v.trim() ? v : w);

/** Олди-сотди шартномаси — the company's sample text, filled from the Loyiha, client and requisites. */
export function ContractPrint() {
  const { id } = useParams();
  const project = projectsApi.useDetail(id);
  const company = useCompany();
  const p = project.data;
  const c = company.data;
  if (!p || !c) return null;

  const soum = p.currency === "UZS";
  const money = (v: string | number) => {
    const amount = Number(v);
    if (!soum) return `${n0(amount)} ${p.currency}`;
    const usd = p.usd_rate ? ` (${n0(amount / Number(p.usd_rate))}$)` : "";
    return `${n0(amount)} сўм${usd}`;
  };
  const date = d(p.contract_date ?? p.sale_date) || "__________";
  const profile = p.calcs.map((x) => x.title).join(", ")
    || [p.brand?.name, ...p.items.map((i) => i.product_type.name)].filter(Boolean).join(" + ");
  const seller = `«${c.name}»${c.legal_form ? ` ${c.legal_form}` : ""}`;

  const spec: [string, ReactNode][] = [
    ["Маҳсулотлар номи", p.product_name || p.name],
    ["Профил тури", profile || "-"],
    ["Профил ранги", p.profile_color || "-"],
    ["Эшик аксессуар", p.door_accessory || "-"],
    ["Ром аксессуар", p.window_accessory || "-"],
    ["Подоконник (ранги ва ҳажми)", p.windowsill || "-"],
    ["Ҳимоя сеткаси (ҳашоротлардан)", p.mosquito_net ? "Бор" : "-"],
    ["Ойна тури ва ранги", p.glass || "-"],
    ["Шотландка", p.shotlandka || "-"],
    ["Маҳсулот сони", p.total_quantity ? `${p.total_quantity} шт` : "-"],
    ["Маҳсулот (кв.м)", Number(p.total_area) ? `${Number(p.total_area).toLocaleString("ru-RU")} м2` : "-"],
    ["Масъул шахс", p.manager?.name ?? "-"],
  ];

  return (
    <PrintFrame title={`Shartnoma · ${p.code}`}>
      <div className="text-[13.5px] leading-[1.45]">
        <h1 className="text-center text-[15px] font-bold">ОЛДИ-СОТДИ ШАРТНОМАСИ № {blank(p.contract_number || p.code, "_______")}</h1>
        <div className="mt-3 flex justify-between font-semibold">
          <span>{c.city ? `${c.city} шаҳар` : ""}</span><span>{date}й</span>
        </div>

        <p className="mt-3 text-justify indent-8">
          Бир томондан устав асосида иш юритувчи {seller} номидан корхона директори {blank(c.director_short)} (кейинги
          ўринларда «Сотувчи» деб юритилади), иккинчи томондан фуқаро <b>{p.client.name}</b> (кейинги ўринларда «Сотиб
          олувчи» деб юритилади), биргаликда қуйидагилар тўғрисида мазкур шартномани туздилар:
        </p>

        <h2 className="mt-3 text-center font-bold">1. ШАРТНОМА ПРЕДМЕТИ.</h2>
        <p className="text-justify">1.1. Сотувчи ўзига тегишли маҳсулотни Сотиб олувчига тайёр маҳсулот қилиб етказиб бериш ва ўрнатиш,
          Сотиб олувчи эса ушбу маҳсулотни ҳақини тўлаш ва қабул қилиш мажбуриятини олади.</p>
        <p>1.2. Маҳсулот ҳақида маълумотлар:</p>
        <table className="grid-table mt-1">
          <tbody>
            <tr><td colSpan={2} className="text-center font-bold">Маҳсулотларни ишлаб чиқариш учун талабнома</td></tr>
            {spec.map(([k, v]) => (
              <tr key={k}><td className="w-[45%] font-semibold">{k}</td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
        <table className="grid-table mt-2 text-center">
          <tbody>
            <tr className="font-semibold">
              <td>Умумий сумма</td><td>Сана</td><td>Аванс</td><td>Қолдиқ</td><td>Имзо (иш бажарувчи)</td><td>Имзо (буюртмачи)</td>
            </tr>
            <tr className="h-12">
              <td className="font-bold">{money(p.amount)}</td>
              <td>{d(p.advance_date) || date}</td>
              <td>{Number(p.advance_amount) ? money(p.advance_amount) : ""}</td>
              <td>{money(p.debt_amount)}</td>
              <td /><td />
            </tr>
          </tbody>
        </table>

        <h2 className="mt-3 text-center font-bold">2. ТЎЛОВ ШАРТЛАРИ.</h2>
        <p className="text-justify">2.1. Ушбу шартнома бўйича тўлов қуйидаги тартибда амалга оширилади: Шартнома икки томон ўртасида
          имзоланганидан сўнг, Сотувчига умумий сумманинг камида {c.prepay_percent}% олдиндан тўлаши шарт. Мижоз маҳсулот тайёр
          бўлганлиги ҳақида маълумот олганидан сўнг қолган суммани 100% тўлайди. Шундан сўнг у ўз маҳсулотини қабул қилиб олади.</p>
        <p>2.2. Тўлов шакли: Нақд пул ёки банк пластик картаси орқали амалга оширилади.</p>

        <h2 className="mt-3 text-center font-bold">3. ТАРАФЛАРНИНГ МАЖБУРИЯТЛАРИ.</h2>
        <p>3.1. Сотувчининг мажбуриятлари:</p>
        <p className="text-justify">3.2. Шартноманинг 1.2 бандида кўрсатилган маҳсулотни Сотиб олувчига тўлов амалга оширилган санадан
          бошлаб, {c.delivery_days} банк куни ичида Сотиб олувчига топшириши шарт.</p>
        <p>3.3. Маҳсулотни шартнома шартларига жавоб берадиган ҳолатда ва сифатда топшириш.</p>
        <p>3.4. Сотиб олувчининг мажбуриятлари:</p>
        <p>3.5. Маҳсулотни шартномада белгиланган муддатларда пулини тўлиқ тўлаш ва қабул қилиб олиш;</p>
        <p className="text-justify">3.6. Маҳсулотни тайёр бўлганлиги ҳақида маълумот олгандан сўнг 5 кун муддатда қабул қилиш.
          Маҳсулотнинг мазкур шартнома талабларига мос келмаслиги аниқланган тақдирда, Сотиб олувчи шу муддатда Сотувчига
          аниқланган номувофиқликлар ҳақида маълумотларни акс эттирувчи хабарнома юбориш.</p>

        <h2 className="mt-3 text-center font-bold">4. ШАРТНОМАНИ ЎЗГАРТИРИШ ВА БЕКОР ҚИЛИШ ТАРТИБИ.</h2>
        <p className="text-justify">4.1. Ушбу шартномага ҳар қандай ўзгартириш ва қўшимчалар улар ёзма равишда расмийлаштирилган ва
          тарафларнинг ваколатли шахслари томонидан имзоланган тақдирда ҳақиқий ҳисобланади.</p>
        <p className="text-justify">4.2. Шартномани муддатидан олдин бекор қилишга тарафларнинг келишувига мувофиқ ёки Ўзбекистон
          Республикасининг амалдаги қонун ҳужжатларида назарда тутилган асосларга кўра, етказилган зарар қопланган ҳолда йўл қўйилади.</p>

        <h2 className="mt-3 text-center font-bold">5. НИЗОЛАРНИ ҲАЛ ҚИЛИШ ТАРТИБИ.</h2>
        <p className="text-justify">5.1. Ушбу шартнома бўйича ёки у билан боғлиқ ҳолда тарафлар ўртасида келиб чиқадиган барча низолар
          ёзма талабнома билдириш тартибига риоя қилинган ҳолда ҳал этилади.</p>
        <p className="text-justify">5.2. Билдирган талабномасига қонунда белгиланган бир ойлик муддат ичида жавоб олмаган ёки талаблари
          қаноатлантирилмаган тақдирда, ҳуқуқи бузилган деб ҳисобловчи тараф низони ҳал қилиш учун даъво аризаси билан жавобгар
          жойлашган иқтисодий судга мурожаат қилишга ҳақли.</p>

        <h2 className="mt-3 text-center font-bold">6. БОШҚА ШАРТЛАР.</h2>
        <p className="text-justify">6.1. Шартнома икки нусхада тузилган бўлиб, иккаласи ҳам бир хил юридик кучга эга деб ҳисобланади ва
          тарафларга бир нусхадан берилади.</p>
        <p>6.2. Шартнома икки томондан имзоланиб, Сотиб олувчи томонидан тўловни амалга оширилган пайтдан бошлаб кучга киради.</p>
        <p>6.3. Шартноманинг барча шартлари икки томондан тўлиқ амалга оширилган пайтдан бошлаб тамомланган ҳисобланади.</p>

        <h2 className="mt-3 text-center font-bold">7. ФОРС-МАЖОР ҲОЛАТЛАРИ.</h2>
        <p className="text-justify">7.1. Ўзбекистон Республикаси қонунчилигида белгиланган форс-мажор ҳолатлари мазкур шартномага татбиқ
          этилади. Форс-мажор даврида тарафлар мазкур ҳолат даврига даъво қилиши мумкин эмас.</p>

        <h2 className="mt-3 text-center font-bold">8. ТАРАФЛАРНИНГ ЮРИДИК МАНЗИЛЛАРИ ВА РЕКВИЗИТЛАРИ.</h2>
        <table className="mt-2 [&_td]:align-top [&_td]:py-0.5">
          <tbody>
            <tr>
              <td className="w-1/2 pr-4">
                <p className="font-bold">Сотувчи:</p>
                <p className="font-bold">{seller}</p>
                <p>Манзил: {blank(c.address)}</p>
                <p>Х/Р: {blank(c.bank_account)}</p>
                {c.bank_name && <p>Банк: {c.bank_name}</p>}
                <p>ИНН: {blank(c.inn)}</p>
                <p>МФО: {blank(c.mfo)}</p>
                <p>Телефон: {blank(c.phone)}</p>
                <p className="mt-4">Директор: _________________ {c.director_short}</p>
              </td>
              <td className="w-1/2 pl-4">
                <p className="font-bold">Сотиб олувчи:</p>
                <p>ФИО: <b>{p.client.name}</b></p>
                <p>Паспорт: {blank(p.client_passport)}</p>
                <p>Манзил: {blank(p.client_address || p.object_address)}</p>
                <p>Телефон: {blank(p.phone || p.client_phone)}</p>
                <p className="mt-4">Имзо: _________________</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PrintFrame>
  );
}
