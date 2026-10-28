// Toasts: call toast.ok("Saqlandi") / toast.error("…") from anywhere; <Toaster/> is mounted once in main.tsx.
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useSyncExternalStore } from "react";

type T = { id: number; tone: "ok" | "bad"; text: string };
let items: T[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(tone: T["tone"], text: string, ms: number) {
  const id = ++seq;
  items = [...items, { id, tone, text }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), ms);
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  ok: (text: string) => push("ok", text, 2500),
  error: (text: string) => push("bad", text, 5000),
};

export function Toaster() {
  const list = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => items);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] grid w-80 gap-2" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="pop anim-pop pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 text-sm">
          {t.tone === "ok" ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" />}
          <span className="min-w-0 flex-1">{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Yopish"><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}
