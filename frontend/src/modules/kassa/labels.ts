import type { StatusMap } from "@/components/Status";

import type { AccountKind, Direction, OrderKind, OrderStatus, PaymentRequestStatus, Posting } from "./api";

export const ORDER_STATUS: StatusMap<OrderStatus> = {
  draft: { label: "Qoralama", tone: "neutral" },
  posted: { label: "O'tkazilgan", tone: "ok" },
  cancelled: { label: "Bekor qilingan", tone: "bad" },
};

/** Pul so'rovi: the buyer reads "Kutilmoqda / Tasdiqlandi / Rad etildi / To'langan". */
export const PAYMENT_REQUEST_STATUS: StatusMap<PaymentRequestStatus> = {
  draft: { label: "Qoralama", tone: "neutral" },
  submitted: { label: "Kutilmoqda", tone: "warn" },
  approved: { label: "Tasdiqlandi", tone: "accent" },
  rejected: { label: "Rad etildi", tone: "bad" },
  paid: { label: "To'langan", tone: "ok" },
  cancelled: { label: "Bekor qilindi", tone: "bad" },
};

export const ORDER_KIND: Record<OrderKind, string> = { in: "Kirim", out: "Chiqim", transfer: "O'tkazma" };
export const ACCOUNT_KIND: Record<AccountKind, string> = { cash: "Kassa", bank: "Bank" };
export const DIRECTION: Record<Direction, string> = { in: "Kirim", out: "Chiqim", both: "Ikkalasi" };
export const POSTING: Record<Posting, string> = {
  partner_customer: "Mijoz — 4010 / 6310", partner_supplier: "Yetkazib beruvchi — 6010 / 4310", account: "Hisob roli",
};

/** PKO / RKO / BK / BT / OT — the paper form's name, by account kind and direction. */
export const formName = (accountKind: AccountKind, kind: OrderKind) =>
  kind === "transfer" ? "O'tkazma" : accountKind === "cash"
    ? (kind === "in" ? "Kirim kassa orderi (PKO)" : "Chiqim kassa orderi (RKO)")
    : (kind === "in" ? "Bank kirimi (BK)" : "To'lov topshiriqnomasi (BT)");

export const unit = (currency: string) => (currency === "UZS" ? "so'm" : currency);
