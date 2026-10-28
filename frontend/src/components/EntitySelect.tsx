import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, type Page } from "@/lib/api";

import { Spinner } from "./ui";

export type Option = { id: number; code?: string | null; name?: string; username?: string; full_name?: string };

const nameOf = (o: Option) => o.name ?? o.full_name ?? o.username ?? `#${o.id}`;

/**
 * Searchable remote picker for any list endpoint (clients, employees, users, roles…).
 * `current` is the selected record so its name shows before anything is fetched.
 */
export function EntitySelect({ endpoint, value, onChange, current, extraParams, placeholder = "Tanlang…", error, disabled, className = "" }: {
  endpoint: string;
  value: number | null;
  onChange: (id: number | null, option: Option | null) => void;
  current?: Option | null;
  extraParams?: Record<string, string>;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Option | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["picker", endpoint, debounced, extraParams],
    queryFn: async () => (await api.get<Page<Option>>(`/${endpoint}/`, { params: { q: debounced, size: 20, ...extraParams } })).data,
    enabled: open,
    staleTime: 30_000,
  });
  const items = data?.items ?? [];

  const selected = useMemo(() => {
    if (!value) return null;
    if (picked?.id === value) return picked;
    if (current?.id === value) return current;
    return items.find((o) => o.id === value) ?? null;
  }, [value, picked, current, items]);

  const choose = (o: Option | null) => {
    setPicked(o);
    onChange(o?.id ?? null, o);
    setOpen(false);
    setQ("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && items[active]) { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <div
        className={`flex h-9 items-center rounded-lg border bg-surface pl-3 pr-1.5 text-sm ${disabled ? "cursor-not-allowed bg-ground text-muted" : "hover:border-line-strong"} ${
          error ? "border-bad" : open ? "border-accent ring-2 ring-accent/15" : "border-line"}`}
        onClick={() => { if (!disabled) { setOpen(true); input.current?.focus(); } }}
      >
        <input
          ref={input}
          disabled={disabled}
          value={open ? q : selected ? nameOf(selected) : ""}
          placeholder={selected && open ? nameOf(selected) : placeholder}
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
        />
        {selected && !disabled ? (
          <button type="button" tabIndex={-1} aria-label="Tozalash" onClick={(e) => { e.stopPropagation(); choose(null); }}
            className="grid size-6 place-items-center rounded text-muted hover:text-ink"><X className="size-3.5" /></button>
        ) : (
          <ChevronsUpDown className="mr-1 size-3.5 text-faint" />
        )}
      </div>
      {open && !disabled && (
        <div className="pop anim-pop absolute left-0 right-0 z-40 mt-1 max-h-64 origin-top overflow-y-auto py-1">
          {items.map((o, i) => (
            <button key={o.id} type="button" onMouseEnter={() => setActive(i)} onClick={() => choose(o)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === active ? "bg-ground" : ""}`}>
              <span className="min-w-0 flex-1 truncate">{nameOf(o)}</span>
              {o.code && <span className="font-mono text-2xs text-muted">{o.code}</span>}
              {o.id === value && <Check className="size-3.5 text-accent-ink" />}
            </button>
          ))}
          {!items.length && (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted">{isFetching ? <><Spinner /> Qidirilmoqda…</> : "Topilmadi"}</p>
          )}
        </div>
      )}
    </div>
  );
}
