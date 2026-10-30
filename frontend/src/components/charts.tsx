// Dashboard charts (add-dashboard-analytics): plain HTML/CSS bars on the house tokens, no chart library.
// Rules from the data-viz guide: series colours in fixed order (--color-series-N), thin bars with rounded
// tops anchored to the baseline and a 2px gap, recessive grid, numbers in ink (never in the series colour),
// a hover tooltip per month, a legend for two or more series, and a table view of the same numbers.
import { BarChart3, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

export const monthLabel = (ym: string, long = false) => {
  const [y, m] = ym.split("-").map(Number);
  return long ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
};

/** 1 250 000 → "1,25 mln"; 3 400 → "3,4 ming"; counts stay whole. */
export function compact(v: number): string {
  const a = Math.abs(v);
  const f = (n: number, unit: string) => `${(v < 0 ? -n : n).toLocaleString("ru-RU", { maximumFractionDigits: n < 10 ? 2 : 1 })} ${unit}`;
  if (a >= 1e9) return f(a / 1e9, "mlrd");
  if (a >= 1e6) return f(a / 1e6, "mln");
  if (a >= 1e4) return f(a / 1e3, "ming");
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 0 }).replace(/[  ]/g, " ");
}

export const full = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 }).replace(/[  ]/g, " ");

export type Series = { key: string; label: string };
const COLOR = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)", "var(--color-series-4)"];

/** A nice round top for the axis: 1, 2, 2.5, 5 × 10^n above the maximum. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: COLOR[i] }} />{s.label}
        </span>
      ))}
    </div>
  );
}

/** Grouped monthly bars. `rows` = [{month: "2026-10", a: "123", b: "45"}]; one bar per series per month. */
export function MonthBars({ rows, series, unit = "so'm", height = 168 }: {
  rows: Record<string, string | number>[]; series: Series[]; unit?: string; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const num = (r: Record<string, string | number>, k: string) => Number(r[k] ?? 0) || 0;
  const max = niceMax(Math.max(0, ...rows.flatMap((r) => series.map((s) => num(r, s.key)))));
  const ticks = [max, max / 2, 0];
  const empty = rows.every((r) => series.every((s) => !num(r, s.key)));

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Legend series={series} />
        <button type="button" onClick={() => setTable(!table)} aria-pressed={table}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs text-muted hover:bg-sunk hover:text-ink">
          {table ? <><BarChart3 className="size-3.5" strokeWidth={1.75} /> Grafik</> : <><Table2 className="size-3.5" strokeWidth={1.75} /> Jadval</>}
        </button>
      </div>
      {table ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-line text-left text-muted">
              <th className="px-2.5 py-1.5 font-medium">Oy</th>
              {series.map((s) => <th key={s.key} className="px-2.5 py-1.5 text-right font-medium">{s.label}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.month)} className="border-b border-line last:border-0">
                  <td className="px-2.5 py-1">{monthLabel(String(r.month), true)}</td>
                  {series.map((s) => <td key={s.key} className="px-2.5 py-1 text-right tabular">{full(num(r, s.key))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative flex gap-2" onMouseLeave={() => setHover(null)}>
          <div className="flex shrink-0 flex-col justify-between pb-5 text-right text-2xs tabular text-faint" style={{ height }}>
            {ticks.map((t, i) => <span key={i} className="-translate-y-1/2 leading-none">{compact(t)}</span>)}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 20 }}>
              {ticks.map((_, i) => <div key={i} className={`border-t ${i === ticks.length - 1 ? "border-line-strong" : "border-dashed border-line"}`} />)}
            </div>
            <div className="relative flex items-end" style={{ height: height - 20 }}>
              {rows.map((r, i) => (
                <div key={String(r.month)} className="flex h-full flex-1 items-end justify-center gap-[2px] px-[3px]"
                  onMouseEnter={() => setHover(i)}>
                  {hover === i && <div className="pointer-events-none absolute inset-y-0 -z-0 rounded-md bg-sunk/60"
                    style={{ left: `${(i / rows.length) * 100}%`, width: `${100 / rows.length}%` }} />}
                  {series.map((s, j) => {
                    const v = num(r, s.key);
                    return <div key={s.key} className="relative w-full max-w-4 rounded-t-[4px]"
                      style={{ height: `${v > 0 ? Math.max((v / max) * 100, 1.5) : 0}%`, background: COLOR[j] }} />;
                  })}
                </div>
              ))}
            </div>
            <div className="flex h-5 items-end">
              {rows.map((r, i) => (
                <span key={String(r.month)} className={`flex-1 text-center text-2xs ${hover === i ? "font-medium text-ink" : "text-faint"}`}>
                  {monthLabel(String(r.month))}
                </span>
              ))}
            </div>
            {empty && <p className="absolute inset-x-0 top-1/3 text-center text-xs text-muted">Bu davrda ma'lumot yo'q</p>}
            {hover !== null && rows[hover] && (
              <div className="pop pointer-events-none absolute top-1 z-30 min-w-40 px-3 py-2 text-xs"
                style={hover > rows.length / 2 ? { right: `${((rows.length - hover) / rows.length) * 100}%` } : { left: `${((hover + 1) / rows.length) * 100}%` }}>
                <p className="mb-1 font-semibold">{monthLabel(String(rows[hover].month), true)}</p>
                {series.map((s, j) => (
                  <p key={s.key} className="flex items-center gap-2">
                    <span className="size-2 rounded-sm" style={{ background: COLOR[j] }} />
                    <span className="flex-1 text-muted">{s.label}</span>
                    <b className="tabular font-medium">{full(num(rows[hover], s.key))}{unit && ` ${unit}`}</b>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for a ranked list (top clients, stock by category). Values in ink beside the bar. */
export function RankBars({ rows, unit = "so'm", empty = "Hozircha yo'q" }: {
  rows: { key: string | number; label: ReactNode; value: number; sub?: ReactNode; to?: string }[]; unit?: string; empty?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length || max <= 0) return <p className="py-4 text-center text-xs text-muted">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-baseline gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
              {r.sub && <span className="text-muted">{r.sub}</span>}
              <b className="tabular font-medium" title={`${full(r.value)} ${unit}`}>{compact(r.value)}{unit && <span className="font-normal text-muted"> {unit}</span>}</b>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-sunk">
              <div className="h-full rounded-full" style={{ width: `${Math.max((r.value / max) * 100, 1)}%`, background: COLOR[0] }} />
            </div>
          </>
        );
        return <li key={r.key}>{r.to ? <Link to={r.to} className="block rounded-md hover:bg-ground">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}
