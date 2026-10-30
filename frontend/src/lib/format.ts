import dayjs from "dayjs";

export const fmtDate = (v?: string | null) => (v ? dayjs(v).format("DD.MM.YYYY") : "—");
export const fmtDateTime = (v?: string | null) => (v ? dayjs(v).format("DD.MM.YYYY HH:mm") : "—");

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
// ru-RU groups thousands with a no-break space and uses a comma before the kopecks: "5 986,38".
// Only the grouping space is normalised — the comma is the decimal separator and must stay.
const plain = (s: string) => s.replace(/[  ]/g, " ");
export const unitOf = (currency: string) => (currency === "UZS" ? "so'm" : currency);
export const fmtMoney = (v: string | number | null | undefined, currency?: string) => {
  if (v === null || v === undefined || v === "") return "—";
  const s = plain(money.format(Number(v)));
  return currency ? `${s} ${unitOf(currency)}` : s;
};

/** Date -> "YYYY-MM-DD" for the API (no timezone shift). */
export const toApiDate = (d: Date | null | undefined) => (d ? dayjs(d).format("YYYY-MM-DD") : null);
export const fromApiDate = (s: string | null | undefined) => (s ? dayjs(s).toDate() : null);

/** "12 500 000,50" or "12500000.5" -> 12500000.5 (NaN if not a number). Strips normal and no-break spaces. */
export const toNum = (v: string | number) => Number(String(v).replace(/[\s  ]/g, "").replace(",", "."));

/** 20.5 -> "20,5 m²" */
export const fmtArea = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : `${plain(money.format(Number(v)))} m²`;

export const isOverdue = (deadline: string | null, finished: boolean) =>
  !!deadline && !finished && dayjs(deadline).isBefore(dayjs(), "day");
