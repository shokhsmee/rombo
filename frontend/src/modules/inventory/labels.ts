import type { StatusMap } from "@/components/Status";

import type { Category, MoveStatus, MoveType } from "./api";

export const MOVE_STATUS: StatusMap<MoveStatus> = {
  draft: { label: "Qoralama", tone: "neutral" },
  posted: { label: "O'tkazilgan", tone: "ok" },
  cancelled: { label: "Bekor qilingan", tone: "bad" },
};

export const MOVE_TYPE: Record<MoveType, string> = {
  receipt: "Kirim", issue: "Chiqim", output: "Ishlab chiqarish", delivery: "Yetkazish", transfer: "Ko'chirish", adjust: "Tuzatish",
};

/** What a type means, one line, for the form and the menu. */
export const MOVE_HINT: Record<MoveType, string> = {
  receipt: "Yetkazib beruvchidan — Ta'minot → Kirim (KR) o'tkazilganda o'zi yoziladi",
  issue: "Materialni loyiha ishlab chiqarishiga berish · Dt 2010 Kt 1010",
  output: "Tayyor mahsulot omborga kirdi · Dt 2810 Kt 2010",
  delivery: "Tayyor mahsulot mijozga · Dt 9110 Kt 2810",
  transfer: "Omborlar orasida · o'tkazma yozilmaydi",
  adjust: "Sanoq: ortiqcha (+) Dt 1010 Kt 9390 · kamomad (−) Dt 9430 Kt 1010",
};

/** + / − of a row for its warehouse (transfers show both sides in the list). */
export const SIGN: Record<MoveType, 1 | -1 | 0> = { receipt: 1, output: 1, issue: -1, delivery: -1, transfer: 0, adjust: 0 };

export const CATEGORY: Record<Category, string> = {
  profil: "Profil", oyna: "Oyna", furnitura: "Furnitura", material: "Boshqa material", yarim: "Yarim tayyor", tayyor: "Tayyor mahsulot",
};

export const qty = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  return Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 3 }).replace(/[  ]/g, " ");
};
