import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { api, type Page } from "@/lib/api";

import { Spinner } from "./ui";

export type Option = { id: number; code?: string | null; name?: string; username?: string; full_name?: string };

const nameOf = (o: Option) => o.name ?? o.full_name ?? o.username ?? `#${o.id}`;

type CreateRow = { kind: "create" | "edit"; label: string };

/**
 * Searchable remote picker for any list endpoint (clients, employees, users, roles…).
 * `current` is the selected record so its name shows before anything is fetched.
 * With `onCreate` / `onCreateEdit` the dropdown ends with Odoo-style rows — "«text» yaratish" and
 * "Yaratish va to'ldirish…" — whenever the typed text has no exact match.
 */
export function EntitySelect({ endpoint, value, onChange, current, extraParams, placeholder = "Tanlang…", error, disabled, className = "", onCreate, onCreateEdit, describe }: {
  endpoint: string;
  value: number | null;
  onChange: (id: number | null, option: Option | null) => void;
  current?: Option | null;
  extraParams?: Record<string, string>;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  /** Quick create with the typed text (the caller posts and then selects the result). */
  onCreate?: (query: string) => void | Promise<void>;
  /** Open a fuller create form pre-filled with the typed text. */
  onCreateEdit?: (query: string) => void;
  /** Right side of an option instead of its code, e.g. "12 dona" for a product picker. */
  describe?: (option: Option & Record<string, unknown>) => ReactNode;
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

  const text = q.trim();
  const creates: CreateRow[] = useMemo(() => {
    if (!text || (!onCreate && !onCreateEdit)) return [];
    if (items.some((o) => nameOf(o).toLowerCase() === text.toLowerCase())) return [];
    const rows: CreateRow[] = [];
    if (onCreate) rows.push({ kind: "create", label: `«${text}» yaratish` });
    if (onCreateEdit) rows.push({ kind: "edit", label: "Yaratish va to'ldirish…" });
    return rows;
  }, [text, items, onCreate, onCreateEdit]);
  const total = items.length + creates.length;

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

  const create = (row: CreateRow) => {
    const typed = text;
    setOpen(false);
    setQ("");
    setPicked(null);
    if (row.kind === "create") void onCreate?.(typed);
    else onCreateEdit?.(typed);
  };

  const pick = (i: number) => {
    if (i < items.length) choose(items[i]);
    else if (creates[i - items.length]) create(creates[i - items.length]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && total) { e.preventDefault(); pick(active); }
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
              {describe ? <span className="shrink-0 text-2xs text-muted">{describe(o as Option & Record<string, unknown>)}</span>
                : o.code && <span className="font-mono text-2xs text-muted">{o.code}</span>}
              {o.id === value && <Check className="size-3.5 text-accent-ink" />}
            </button>
          ))}
          {!items.length && (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted">{isFetching ? <><Spinner /> Qidirilmoqda…</> : "Topilmadi"}</p>
          )}
          {creates.length > 0 && !isFetching && (
            <div className={items.length ? "mt-1 border-t border-line pt-1" : ""}>
              {creates.map((row, j) => {
                const i = items.length + j;
                return (
                  <button key={row.kind} type="button" onMouseEnter={() => setActive(i)} onClick={() => create(row)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-accent-ink ${i === active ? "bg-ground" : ""}`}>
                    <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
