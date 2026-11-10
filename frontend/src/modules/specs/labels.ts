import type { PageKey } from "@/auth/AuthProvider";
import type { StatusMap } from "@/components/Status";

// Page keys from backend apps/access/registry.py (Pages.SPECS / FIX_IDEAS / MCP).
export const PAGE_SPECS: PageKey = "specs";
export const PAGE_IDEAS: PageKey = "fix_ideas";
export const PAGE_MCP: PageKey = "mcp";

export type DocKind = "project" | "spec" | "change" | "archived";
export type IdeaStatus = "new" | "accepted" | "done" | "rejected";
export type IdeaKind = "fix" | "improvement" | "feature";
export type IdeaPriority = "low" | "normal" | "high";
export type IdeaSource = "mcp" | "manual";

export const DOC_KIND: Record<DocKind, string> = {
  project: "Loyiha konteksti",
  spec: "Spetsifikatsiyalar",
  change: "Faol o'zgarishlar",
  archived: "Arxiv",
};

export const STATUS: StatusMap<IdeaStatus> = {
  new: { label: "Yangi", tone: "warn" },
  accepted: { label: "Qabul qilindi", tone: "accent" },
  done: { label: "Bajarildi", tone: "ok" },
  rejected: { label: "Rad etildi", tone: "bad" },
};

export const KIND: Record<IdeaKind, string> = { fix: "Tuzatish", improvement: "Yaxshilash", feature: "Yangi imkoniyat" };
export const PRIORITY: StatusMap<IdeaPriority> = {
  low: { label: "Past", tone: "neutral" },
  normal: { label: "O'rta", tone: "info" },
  high: { label: "Yuqori", tone: "bad" },
};
export const SOURCE: Record<IdeaSource, string> = { mcp: "Claude", manual: "Qo'lda" };

/** Verb for the button that moves an idea to `to`. */
export const ACTION: Record<IdeaStatus, string> = {
  accepted: "Qabul qilish",
  done: "Bajarildi",
  rejected: "Rad etish",
  new: "Qayta ochish",
};
