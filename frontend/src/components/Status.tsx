import { Pill, type Tone } from "./ui";

export function ActivePill({ active, on = "Faol", off = "Nofaol" }: { active: boolean; on?: string; off?: string }) {
  return <Pill tone={active ? "ok" : "neutral"}>{active ? on : off}</Pill>;
}

export type StatusMap<K extends string> = Record<K, { label: string; tone: Tone }>;
