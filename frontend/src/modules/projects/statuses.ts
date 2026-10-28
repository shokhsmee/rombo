import type { StatusMap } from "@/components/Status";

import type { ProjectStatus } from "./api";

export const STATUS: StatusMap<ProjectStatus> = {
  draft: { label: "Qoralama", tone: "neutral" },
  confirmed: { label: "Tasdiqlangan", tone: "accent" },
  procurement: { label: "Xaridda", tone: "warn" },
  production: { label: "Ishlab chiqarishda", tone: "info" },
  ready: { label: "Tayyor", tone: "done" },
  delivered: { label: "Yetkazildi", tone: "ok" },
  closed: { label: "Yopildi", tone: "neutral" },
  cancelled: { label: "Bekor qilindi", tone: "bad" },
};

/** Main path shown in the status track (cancelled is shown on its own). */
export const PIPELINE: ProjectStatus[] = ["draft", "confirmed", "procurement", "production", "ready", "delivered", "closed"];

export const FINISHED: ProjectStatus[] = ["delivered", "closed", "cancelled"];

/** Verb for the button that moves to a status. */
export const ACTION_LABEL: Record<ProjectStatus, string> = {
  draft: "Qoralamaga qaytarish",
  confirmed: "Tasdiqlash",
  procurement: "Xaridga o'tkazish",
  production: "Ishlab chiqarishga",
  ready: "Tayyor",
  delivered: "Yetkazildi",
  closed: "Yopish",
  cancelled: "Bekor qilish",
};
