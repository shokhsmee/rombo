import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Debounced search box. "/" focuses it from anywhere on the page. */
export function SearchInput({ value, onChange, placeholder = "Qidirish…" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const push = (v: string) => {
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), 300);
  };

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        ref={ref}
        value={local}
        onChange={(e) => push(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-8 text-sm text-ink placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
      />
      {local ? (
        <button type="button" onClick={() => { setLocal(""); onChange(""); }} aria-label="Tozalash"
          className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted hover:text-ink">
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line px-1 font-mono text-2xs text-faint">/</kbd>
      )}
    </div>
  );
}
