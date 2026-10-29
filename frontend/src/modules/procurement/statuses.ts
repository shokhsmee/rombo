import type { StatusMap } from "@/components/Status";

import type { OrderStatus, ReceiptStatus, RequestStatus, SentVia } from "./api";

export const REQUEST_STATUS: StatusMap<RequestStatus> = {
  draft: { label: "Qoralama", tone: "neutral" },
  submitted: { label: "Tasdiqlashga", tone: "warn" },
  approved: { label: "Tasdiqlangan", tone: "accent" },
  rejected: { label: "Rad etilgan", tone: "bad" },
  ordered: { label: "Buyurtma qilingan", tone: "ok" },
  cancelled: { label: "Bekor qilindi", tone: "bad" },
};
export const REQUEST_PIPELINE: RequestStatus[] = ["draft", "submitted", "approved", "ordered"];

export const ORDER_STATUS: StatusMap<OrderStatus> = {
  draft: { label: "Qoralama", tone: "neutral" },
  sent: { label: "Yuborilgan", tone: "accent" },
  partially_received: { label: "Qisman kelgan", tone: "warn" },
  received: { label: "Kelgan", tone: "ok" },
  cancelled: { label: "Bekor qilindi", tone: "bad" },
};
export const ORDER_PIPELINE: OrderStatus[] = ["draft", "sent", "partially_received", "received"];

export const RECEIPT_STATUS: StatusMap<ReceiptStatus> = {
  draft: { label: "Qoralama", tone: "neutral" },
  posted: { label: "O'tkazilgan", tone: "ok" },
  cancelled: { label: "Bekor qilindi", tone: "bad" },
};
export const RECEIPT_PIPELINE: ReceiptStatus[] = ["draft", "posted"];

export const VIA_LABEL: Record<SentVia, string> = { print: "Chop etib", email: "Email", other: "Boshqa" };
