// CRM → Analitika (ported from uzbridge crm/Analytics.tsx + components/charts.tsx): the voronka and the calls for a
// period. Charts are plain SVG / divs on the design tokens — no chart library.
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { Kpi, Segmented, Select, Spinner } from "@/components/ui";
import { api, cleanParams } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import type { CallAnalytics } from "@/modules/telephony/api";
import { fmtDuration } from "@/modules/telephony/live";

import { TONE_DOT, usePipelines } from "./api";

type Funnel = { stage_id: number | null; name: string; tone: keyof typeof TONE_DOT; leads: number; of_first: number | null; of_prev: number | null; avg_hours: number | null; median_hours: number | null };
type CrmAnalytics = {
  totals: { new: number; won: number; lost: number; open: number; stale: number; win_rate: number | null; won_budget: string;
    avg_deal: string | null; days_to_win: number | null; tasks_open: number; tasks_overdue: number };
  series: { day: string; new: number; won: number; lost: number }[];
  funnel: Funnel[];
  sources: { source: string; new: number; won: number; lost: number; won_budget: string }[];
  lost_reasons: { reason: string; leads: number }[];
  managers: { id: number; name: string; new: number; open: number; won: number; lost: number; won_budget: string; win_rate: number | null;
    response_minutes: number | null; overdue: number; calls: number; talk_seconds: number; missed: number }[];
};

const PRESETS: [string, string, () => [string, string]][] = [
  ["today", "Bugun", () => [dayjs().format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]],
  ["7", "7 kun", () => [dayjs().subtract(6, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]],
  ["30", "30 kun", () => [dayjs().subtract(29, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]],
  ["month", "Shu oy", () => [dayjs().startOf("month").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]],
  ["last", "O'tgan oy", () => [dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"), dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD")]],
  ["90", "90 kun", () => [dayjs().subtract(89, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]],
];

const hours = (h: number | null) => (h === null ? "—" : h < 1 ? `${Math.round(h * 60)} daq` : h < 48 ? `${Math.round(h)} soat` : `${Math.round(h / 24)} kun`);
const minutes = (m: number | null) => (m === null ? "—" : m < 60 ? `${Math.round(m)} daq` : hours(m / 60));

export function AnalyticsPage() {
  const phoneOn = useCan("telephony").view;
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") === "calls" && phoneOn ? "calls" : "funnel";
  const [preset, setPreset] = useState("30");
  const [from, to] = (PRESETS.find(([k]) => k === preset) ?? PRESETS[2])[2]();
  const [pipeline, setPipeline] = useState<number | null>(null);
  const [manager, setManager] = useState<number | null>(null);
  const pipelines = usePipelines();
  const active = (pipelines.data ?? []).filter((p) => p.is_active);
  return (
    <div className="grid gap-4">
      <PageHeader title="Analitika" lede="Voronka, manbalar, menejerlar va qo'ng'iroqlar — davr bo'yicha." />
      <div className="flex flex-wrap items-center gap-2">
        {phoneOn && <Segmented value={tab} onChange={(t) => setSp({ tab: t }, { replace: true })} options={[{ value: "funnel", label: "Voronka" }, { value: "calls", label: "Qo'ng'iroqlar" }]} />}
        <Segmented size="sm" value={preset} onChange={setPreset} options={PRESETS.map(([value, label]) => ({ value, label }))} />
        {tab === "funnel" && active.length > 1 && (
          <Select className="w-44" value={pipeline ?? ""} onChange={(e) => setPipeline(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Asosiy voronka</option>
            {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        {tab === "funnel" && <EntitySelect endpoint="employees" placeholder="Barcha menejerlar" className="w-52" extraParams={{ status: "active" }} value={manager} onChange={(id) => setManager(id)} />}
      </div>
      {tab === "funnel" ? <FunnelTab params={{ date_from: from, date_to: to, pipeline, manager }} /> : <CallsTab params={{ date_from: from, date_to: to }} />}
    </div>
  );
}

function useReport<T>(url: string, params: Record<string, unknown>) {
  return useQuery({ queryKey: [url, params], queryFn: async () => (await api.get<T>(url, { params: cleanParams(params) })).data });
}

// ------------------------------------------------------------------ voronka

function FunnelTab({ params }: { params: Record<string, unknown> }) {
  const q = useReport<CrmAnalytics>("/crm/analytics/", params);
  const d = q.data;
  if (!d) return <div className="grid h-40 place-items-center text-muted"><Spinner className="size-5" /></div>;
  const t = d.totals;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Yangi lidlar" value={t.new} sub={`ochiq ${t.open} · jim ${t.stale}`} />
        <Kpi label="Yutildi" value={t.won} tone="text-ok" sub={t.days_to_win !== null ? `odatda ${t.days_to_win} kunda` : undefined} />
        <Kpi label="Rad etildi" value={t.lost} tone={t.lost ? "text-bad" : ""} />
        <Kpi label="Konversiya" value={t.win_rate !== null ? `${t.win_rate}%` : "—"} />
        <Kpi label="Yutilgan summa" value={fmtMoney(t.won_budget)} sub={t.avg_deal ? `o'rtacha ${fmtMoney(t.avg_deal)}` : undefined} />
        <Kpi label="Ochiq vazifalar" value={t.tasks_open} tone={t.tasks_overdue ? "text-bad" : ""} sub={`muddati o'tgan ${t.tasks_overdue}`} />
      </div>
      <Card title="Kunlar bo'yicha">
        <LineChart rows={d.series} lines={[["new", "Yangi", "stroke-accent"], ["won", "Yutildi", "stroke-ok"], ["lost", "Rad etildi", "stroke-bad"]]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Voronka">
          <div className="grid gap-2">
            {d.funnel.map((f) => (
              <div key={f.name} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><span className={`size-2 rounded-full ${TONE_DOT[f.tone]}`} />{f.name}</span>
                  <span className="text-xs text-muted">
                    <b className="tabular text-ink">{f.leads}</b> · {f.of_first ?? 0}%{f.of_prev !== null && ` · ↓${f.of_prev}%`}
                    {f.median_hours !== null && ` · ${hours(f.median_hours)}`}
                  </span>
                </div>
                <Bar value={f.of_first ?? 0} tone={TONE_DOT[f.tone]} />
              </div>
            ))}
          </div>
        </Card>
        <div className="grid gap-4">
          <Card title="Manbalar">
            <Bars rows={d.sources.slice(0, 8).map((s) => [s.source, s.new, `${s.won} yutildi`])} />
          </Card>
          <Card title="Rad etish sabablari">
            <Bars rows={d.lost_reasons.slice(0, 8).map((r) => [r.reason, r.leads, ""])} tone="bg-bad" />
          </Card>
        </div>
      </div>
      <Card title="Menejerlar">
        <Table head={["Xodim", "Yangi", "Ochiq", "Yutildi", "Rad", "Konversiya", "Summa", "Javob", "Muddati o'tgan", "Qo'ng'iroq", "Suhbat"]}
          rows={d.managers.map((m) => [m.name, m.new, m.open, m.won, m.lost, m.win_rate !== null ? `${m.win_rate}%` : "—", fmtMoney(m.won_budget),
            minutes(m.response_minutes), m.overdue, `${m.calls}${m.missed ? ` (${m.missed} o'tk.)` : ""}`, fmtDuration(m.talk_seconds)])} />
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ calls

const WEEK = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function CallsTab({ params }: { params: Record<string, unknown> }) {
  const q = useReport<CallAnalytics>("/telephony/calls/analytics/", params);
  const [heat, setHeat] = useState<"calls" | "missed">("calls");
  const d = q.data;
  if (!d) return <div className="grid h-40 place-items-center text-muted"><Spinner className="size-5" /></div>;
  const t = d.totals;
  const max = Math.max(1, ...d.heatmap[heat].flat());
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Qo'ng'iroqlar" value={t.calls} sub={`${t.in} kiruvchi · ${t.out} chiquvchi`} />
        <Kpi label="Javob berish" value={t.answer_rate !== null ? `${t.answer_rate}%` : "—"} sub={t.avg_wait !== null ? `kutish ${t.avg_wait} s` : undefined} />
        <Kpi label="Chiquvchi ulandi" value={t.out_rate !== null ? `${t.out_rate}%` : "—"} />
        <Kpi label="O'tkazib yuborilgan" value={t.missed} tone={t.missed ? "text-bad" : ""} sub={`${t.missed_returned} qayta qo'ng'iroq · ${t.missed_open} kutmoqda`} />
        <Kpi label="Qayta qo'ng'iroq" value={minutes(t.callback_minutes)} sub="median" />
        <Kpi label="Suhbat" value={fmtDuration(t.talk_seconds)} sub={t.avg_talk !== null ? `o'rtacha ${fmtDuration(t.avg_talk)}` : undefined} />
      </div>
      <Card title="Kunlar bo'yicha">
        <LineChart rows={d.series} lines={[["in", "Kiruvchi", "stroke-accent"], ["out", "Chiquvchi", "stroke-info"], ["missed", "O'tkazilgan", "stroke-bad"]]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Hafta kunlari × soatlar" action={<Segmented size="sm" value={heat} onChange={setHeat} options={[{ value: "calls", label: "Hammasi" }, { value: "missed", label: "O'tkazilgan" }]} />}>
          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-0.5 text-2xs text-muted">
              <span />{Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 3 ? "" : h}</span>)}
              {d.heatmap[heat].map((row, i) => (
                <div key={WEEK[i]} className="contents">
                  <span>{WEEK[i]}</span>
                  {row.map((n, h) => (
                    <span key={h} title={`${WEEK[i]} ${h}:00 — ${n}`} className={`h-5 rounded-sm ${heat === "missed" ? "bg-bad" : "bg-accent"}`}
                      style={{ opacity: n ? 0.15 + (0.85 * n) / max : 0.05 }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Yangi lidga birinchi qo'ng'iroq">
          <p className="text-sm text-muted">Qo'ng'iroqdan tug'ilmagan lidlar: <b className="text-ink">{d.first_call.leads}</b></p>
          <p className="text-sm text-muted">Qo'ng'iroq qilingan: <b className="text-ink">{d.first_call.called}</b> · {d.first_call.fast_minutes} daqiqada: <b className="text-ok">{d.first_call.fast}</b></p>
          <p className="text-sm text-muted">Median: <b className="text-ink">{minutes(d.first_call.median_minutes)}</b></p>
          <Bar value={d.first_call.leads ? (d.first_call.fast * 100) / d.first_call.leads : 0} tone="bg-ok" />
        </Card>
      </div>
      <Card title="Xodimlar">
        <Table head={["Xodim", "Jami", "Kiruvchi", "Chiquvchi", "Javob %", "Ulandi %", "O'tkazilgan", "Kutmoqda", "Suhbat", "O'rtacha"]}
          rows={d.employees.map((e) => [e.name, e.calls, e.in, e.out, e.answer_rate !== null ? `${e.answer_rate}%` : "—", e.out_rate !== null ? `${e.out_rate}%` : "—",
            e.missed, e.missed_open, fmtDuration(e.talk_seconds), e.avg_talk !== null ? fmtDuration(e.avg_talk) : "—"])} />
      </Card>
      {d.connections.length > 1 && (
        <Card title="Ulanishlar">
          <Table head={["Ulanish", "Jami", "Kiruvchi", "Chiquvchi", "O'tkazilgan", "Suhbat"]}
            rows={d.connections.map((c) => [c.name, c.calls, c.in, c.out, c.missed, fmtDuration(c.talk_seconds)])} />
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ charts

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card grid content-start gap-3 p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="t-h2">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function Bars({ rows, tone = "bg-accent" }: { rows: [string, number, string][]; tone?: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="text-sm text-muted">Ma'lumot yo'q</p>;
  return (
    <div className="grid gap-2">
      {rows.map(([label, n, sub]) => (
        <div key={label} className="grid gap-1">
          <div className="flex justify-between gap-2 text-sm"><span className="truncate">{label}</span><span className="text-xs text-muted"><b className="tabular text-ink">{n}</b>{sub && ` · ${sub}`}</span></div>
          <Bar value={(n * 100) / max} tone={tone} />
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LineChart({ rows, lines }: { rows: any[]; lines: [string, string, string][] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = 180, P = 24;
  const max = Math.max(1, ...rows.flatMap((r) => lines.map(([k]) => Number(r[k]) || 0)));
  const x = (i: number) => P + (rows.length > 1 ? (i * (W - 2 * P)) / (rows.length - 1) : (W - 2 * P) / 2);
  const y = (v: number) => H - P - (v * (H - 2 * P)) / max;
  if (!rows.length) return <p className="text-sm text-muted">Ma'lumot yo'q</p>;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {lines.map(([k, label, cls]) => <span key={k} className="flex items-center gap-1"><svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" className={cls} strokeWidth="3" /></svg>{label}</span>)}
        {hover !== null && <span className="ml-auto text-ink">{dayjs(rows[hover].day).format("DD.MM")}: {lines.map(([k, l]) => `${l} ${rows[hover][k]}`).join(" · ")}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left) / r.width * W - P) / ((W - 2 * P) / Math.max(1, rows.length - 1))); setHover(Math.max(0, Math.min(rows.length - 1, i))); }}>
        {[0, 0.5, 1].map((t) => <line key={t} x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} className="stroke-line" strokeDasharray="3 3" />)}
        <text x={2} y={y(max) + 4} className="fill-faint text-[10px]">{max}</text>
        {lines.map(([k, , cls]) => (
          <polyline key={k} fill="none" className={cls} strokeWidth="2" strokeLinejoin="round"
            points={rows.map((r, i) => `${x(i)},${y(Number(r[k]) || 0)}`).join(" ")} />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={P} y2={H - P} className="stroke-line-strong" />}
        <text x={P} y={H - 4} className="fill-faint text-[10px]">{dayjs(rows[0].day).format("DD.MM")}</text>
        <text x={W - P} y={H - 4} textAnchor="end" className="fill-faint text-[10px]">{dayjs(rows[rows.length - 1].day).format("DD.MM")}</text>
      </svg>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return <p className="text-sm text-muted">Ma'lumot yo'q</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">{head.map((h, i) => <th key={h} className={`px-2 py-2 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={String(r[0])} className="border-b border-line last:border-0">{r.map((c, i) => <td key={i} className={`whitespace-nowrap px-2 py-2 ${i ? "text-right tabular" : "font-medium"}`}>{c}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
