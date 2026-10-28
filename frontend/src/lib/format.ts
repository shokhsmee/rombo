import dayjs from "dayjs";

export const fmtDate = (v?: string | null) => (v ? dayjs(v).format("DD.MM.YYYY") : "—");
export const fmtDateTime = (v?: string | null) => (v ? dayjs(v).format("DD.MM.YYYY HH:mm") : "—");

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
export const fmtMoney = (v: string | number | null | undefined, currency?: string) => {
  if (v === null || v === undefined || v === "") return "—";
  const s = money.format(Number(v)).replace(/,/g, " ");
  return currency ? `${s} ${currency === "UZS" ? "so'm" : currency}` : s;
};

/** Date -> "YYYY-MM-DD" for the API (no timezone shift). */
export const toApiDate = (d: Date | null | undefined) => (d ? dayjs(d).format("YYYY-MM-DD") : null);
export const fromApiDate = (s: string | null | undefined) => (s ? dayjs(s).toDate() : null);

/** "12 500 000,50" or "12500000.5" -> 12500000.5 (NaN if not a number). Strips normal and no-break spaces. */
export const toNum = (v: string | number) => Number(String(v).replace(/[\s  ]/g, "").replace(",", "."));

/** 20.5 -> "20,5 m²" */
export const fmtArea = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : `${money.format(Number(v))} m²`;

export const isOverdue = (deadline: string | null, finished: boolean) =>
  !!deadline && !finished && dayjs(deadline).isBefore(dayjs(), "day");
