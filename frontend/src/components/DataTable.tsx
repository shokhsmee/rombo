import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import type { ListParams } from "@/hooks/useListParams";
import type { Page } from "@/lib/api";
import { rememberIds } from "@/lib/recordNav";

import { Spinner } from "./ui";

export type Column<T> = {
  key: string;
  title: ReactNode;
  render: (row: T) => ReactNode;
  sort?: string; // API sort field; omit = not sortable
  align?: "left" | "right";
  className?: string;
};

type Props<T extends { id: number }> = {
  columns: Column<T>[];
  data: Page<T> | undefined;
  loading: boolean;
  params: ListParams;
  onParams: (p: Partial<{ page: number; sort: string }>) => void;
  onRowClick?: (row: T) => void;
  /** Remember the visible ids so the record page can step ‹ › through them. */
  navKey?: string;
  empty?: ReactNode;
};

function nextSort(current: string, field: string) {
  if (current === field) return `-${field}`;
  if (current === `-${field}`) return "";
  return field;
}

/** Table + "1–25 / 128 ‹ ›" pager, uzbridge style. */
export function DataTable<T extends { id: number }>({ columns, data, loading, params, onParams, onRowClick, navKey, empty }: Props<T>) {
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const from = total ? (params.page - 1) * params.size + 1 : 0;
  const to = Math.min(params.page * params.size, total);
  const last = Math.max(1, Math.ceil(total / params.size));

  useEffect(() => {
    if (navKey && data) rememberIds(navKey, data.items.map((r) => r.id));
  }, [navKey, data]);

  const btn = "grid size-7 place-items-center rounded-md border border-line bg-surface text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted";

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              {columns.map((c) => {
                const active = !!c.sort && params.sort.replace("-", "") === c.sort;
                const Arrow = params.sort.startsWith("-") ? ArrowDown : ArrowUp;
                return (
                  <th key={c.key} className={`whitespace-nowrap px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                    {c.sort ? (
                      <button type="button" onClick={() => onParams({ sort: nextSort(params.sort, c.sort!) })}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink ${active ? "text-ink" : ""}`}>
                        {c.title}
                        {active && <Arrow className="size-3" strokeWidth={2.25} />}
                      </button>
                    ) : c.title}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={loading && items.length ? "opacity-60 transition-opacity" : ""}>
            {items.map((row) => (
              <tr key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-line last:border-0 ${onRowClick ? "cursor-pointer hover:bg-ground" : ""}`}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "whitespace-nowrap text-right tabular" : ""} ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-muted">
            {empty ?? (params.q ? `«${params.q}» bo'yicha hech narsa topilmadi` : "Hozircha yozuv yo'q")}
          </p>
        )}
        {loading && items.length === 0 && <div className="grid place-items-center py-12 text-muted"><Spinner className="size-5" /></div>}
      </div>
      {total > 0 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="tabular text-muted"><b className="font-medium text-ink">{from}–{to}</b> / {total}</span>
          <button type="button" className={btn} disabled={params.page <= 1} onClick={() => onParams({ page: params.page - 1 })} aria-label="Oldingi sahifa">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className={btn} disabled={params.page >= last} onClick={() => onParams({ page: params.page + 1 })} aria-label="Keyingi sahifa">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** The row above a table: search, filters, then actions on the right. */
export function Toolbar({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {children}
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}
