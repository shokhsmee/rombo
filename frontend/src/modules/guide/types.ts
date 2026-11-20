// Qo'llanma: the shape of a guide chapter. Each module has a file in ./chapters with its chapters; GuidePage
// shows the ones whose pages the user may open. Pictures are made by backend/scripts/guide_shots.py.
import type { PageKey } from "@/auth/AuthProvider";

/** A screenshot: `img` is its file name in /guide/<pics>/; `marks[i]` names the red mark number i + 1. */
export type Shot = { img: string; caption: string; marks?: string[] };

/** One block of a chapter: a heading, then any of text, a picture, numbered steps, bullet points, a tip. */
export type GuideBlock = { h: string; text?: string; shot?: Shot; steps?: string[]; points?: string[]; tip?: string };

export type GuideSection = {
  id: string;
  /** the group in the chapter list: "Boshlash", "Savdo", "Ishlab chiqarish"… */
  part: string;
  title: string;
  intro: string;
  /** the folder of its pictures in /guide/ (backend/scripts/guide/<pics>.py makes them) */
  pics: string;
  /** shown when the user may open any of these pages; none — shown to everyone */
  pages?: PageKey[];
  /** who it is for: "Sotuv menejeri uchun" */
  who?: string;
  blocks: GuideBlock[];
  faq?: [string, string][];
  /** the page this chapter is about */
  to?: string;
};
