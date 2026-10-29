import type { StatusMap } from "@/components/Status";

import type { EntryStatus, InvoiceKind, InvoiceStatus, SourceKind } from "./api";

export const INVOICE_STATUS: StatusMap<InvoiceStatus> = {
  draft: { label: "Qoralama", tone: "neutral" },
  confirmed: { label: "Tasdiqlangan", tone: "ok" },
  cancelled: { label: "Bekor qilingan", tone: "bad" },
};

export const INVOICE_KIND: Record<InvoiceKind, string> = { customer: "Mijozga", supplier: "Yetkazib beruvchidan" };

export const ENTRY_STATUS: StatusMap<EntryStatus> = {
  posted: { label: "O'tkazilgan", tone: "ok" },
  reversed: { label: "Storno qilingan", tone: "bad" },
};

export const SOURCE_KIND: Record<SourceKind, string> = { document: "Hujjat", manual: "Qo'lda", reversal: "Storno" };

/** Where a source document opens in the app, by its `source_model`. Other modules add theirs here. */
export const SOURCE_LINK: Record<string, (id: number) => string> = {
  "accounting.invoice": (id) => `/accounting/invoices/${id}`,
};

/** Money in the ledger's style: "12 000 000" (no decimals when whole), "1 234,50" otherwise. */
export const money = (v: string | number | null | undefined, blankZero = false) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (blankZero && n === 0) return "";
  // ru-RU: no-break space between thousands, comma before kopecks — keep the comma, plain-space the groups
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/[\u00a0\u202f]/g, " ");
};
