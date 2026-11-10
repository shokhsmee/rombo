import type { PageKey } from "@/auth/AuthProvider";
import type { StatusMap } from "@/components/Status";

export type RequestStatus = "new" | "assigned" | "accepted" | "in_progress" | "done" | "closed" | "cancelled";
export type RequestKind = "adjust" | "hardware" | "glass" | "net" | "seal" | "install" | "other";
export type RequestSource = "bot" | "phone" | "erp";
export type PhotoStage = "before" | "after";

// Page keys from backend apps/access/registry.py (Pages.SERVICE_REQUESTS / SERVICE_MASTERS).
export const PAGE_REQUESTS: PageKey = "service_requests";
export const PAGE_MASTERS: PageKey = "service_masters";

export const STATUS: StatusMap<RequestStatus> = {
  new: { label: "Yangi", tone: "warn" },
  assigned: { label: "Ustaga berildi", tone: "accent" },
  accepted: { label: "Usta qabul qildi", tone: "accent" },
  in_progress: { label: "Bajarilmoqda", tone: "info" },
  done: { label: "Bajarildi", tone: "done" },
  closed: { label: "Yopildi", tone: "ok" },
  cancelled: { label: "Bekor qilindi", tone: "bad" },
};

/** Main path shown in the status track (cancelled is shown on its own). */
export const PIPELINE: RequestStatus[] = ["new", "assigned", "accepted", "in_progress", "done", "closed"];

/** Statuses where a master can be given (or changed). */
export const ASSIGNABLE: RequestStatus[] = ["new", "assigned", "accepted"];

export const FINISHED: RequestStatus[] = ["closed", "cancelled"];

/** Verb for the button that moves to a status; `from` matters for going back. */
export function actionLabel(to: RequestStatus, from: RequestStatus): string {
  switch (to) {
    case "new": return "Ustadan olish";
    case "accepted": return "Usta qabul qildi";
    case "in_progress": return from === "done" ? "Qayta ochish" : "Ishni boshlash";
    case "done": return "Bajarildi";
    case "closed": return "Yopish";
    case "cancelled": return "Bekor qilish";
    default: return STATUS[to].label;
  }
}

export const KIND: Record<RequestKind, string> = {
  adjust: "Rostlash",
  hardware: "Furnitura",
  glass: "Oyna / paket",
  net: "Maskitka",
  seal: "Germetik, shamol kiradi",
  install: "Qayta o'rnatish",
  other: "Boshqa",
};

export const SOURCE: Record<RequestSource, string> = {
  bot: "Telegram bot",
  phone: "Telefon",
  erp: "ERP",
};

export const STAGE: Record<PhotoStage, string> = {
  before: "Muammo",
  after: "Bajarilgan ish",
};
