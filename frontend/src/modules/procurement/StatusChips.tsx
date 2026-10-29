import type { StatusMap } from "@/components/Status";

/** "Barchasi | Qoralama 3 | Yuborilgan 1 …" — the multi-select status row above a document list. */
export function StatusChips<K extends string>({ statuses, map, selected, counts, onToggle, onClear }: {
  statuses: K[]; map: StatusMap<K>; selected: string[]; counts: Record<string, number>;
  onToggle: (s: K) => void; onClear: () => void;
}) {
  return (
    <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
      <button type="button" onClick={onClear}
        className={`press shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${selected.length ? "border-line bg-surface text-muted hover:text-ink" : "border-ink bg-ink text-on-ink"}`}>
        Barchasi
      </button>
      {statuses.map((s) => {
        const on = selected.includes(s);
        return (
          <button key={s} type="button" onClick={() => onToggle(s)}
            className={`press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
            {map[s].label}
            <span className="tabular opacity-60">{counts[s] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
