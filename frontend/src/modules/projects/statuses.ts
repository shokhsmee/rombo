import type { ProjectStatus } from "./api";

export const STATUS: Record<ProjectStatus, { label: string; color: string }> = {
  draft: { label: "Qoralama", color: "#adb5bd" },
  confirmed: { label: "Tasdiqlangan", color: "#346596" },
  procurement: { label: "Xaridda", color: "#c88a12" },
  production: { label: "Ishlab chiqarishda", color: "#d9661f" },
  ready: { label: "Tayyor", color: "#1c8a7a" },
  delivered: { label: "Yetkazildi", color: "#2f9e44" },
  closed: { label: "Yopildi", color: "#495057" },
  cancelled: { label: "Bekor qilindi", color: "#c92a2a" },
};

/** Main path shown in the pipeline bar (cancelled is shown separately). */
export const PIPELINE: ProjectStatus[] = [
  "draft", "confirmed", "procurement", "production", "ready", "delivered", "closed",
];

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
