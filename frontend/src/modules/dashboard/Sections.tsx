import { ArrowRight, BarChart3, Boxes, BookOpen, Factory, ShoppingCart, SquareKanban, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { MonthBars, RankBars, type Series } from "@/components/charts";
import { Kpi } from "@/components/ui";
import { money } from "@/modules/accounting/labels";
import { CATEGORY } from "@/modules/inventory/labels";

import type { DashKpi, DashSection } from "./api";

const ICON: Record<DashSection["key"], LucideIcon> = {
  sales: BarChart3, crm: SquareKanban, procurement: ShoppingCart, finance: Wallet, accounting: BookOpen, inventory: Boxes, hr: UsersRound,
};
const TONE: Record<string, string> = { bad: "text-bad", ok: "text-ok", warn: "text-warn" };
const n = (v: unknown) => Number(v ?? 0) || 0;
type Row = Record<string, string | number | null>;

function KpiTile({ k }: { k: DashKpi }) {
  const navigate = useNavigate();
  const value = k.unit === "so'm" ? money(k.value) : `${k.value}${k.unit && k.unit !== "so'm" ? ` ${k.unit}` : ""}`;
  return (
    <Kpi label={k.label} tone={TONE[k.tone] ?? ""} onClick={k.link ? () => navigate(k.link!) : undefined}
      value={<>{value}{k.unit === "so'm" && <span className="ml-1 text-xs font-normal text-muted">so'm</span>}</>}
      sub={k.hint || undefined} />
  );
}

function Block({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`grid content-start gap-2 ${wide ? "lg:col-span-2" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{title}</p>
      {children}
    </div>
  );
}

/** One module: header, KPI tiles, its chart and lists. */
export function SectionCard({ s }: { s: DashSection }) {
  const Icon = ICON[s.key] ?? Factory;
  return (
    <section className="card grid gap-4 p-4">
      <header className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent-ink"><Icon className="size-4" strokeWidth={1.75} /></span>
        <h2 className="flex-1 text-base font-semibold">{s.title}</h2>
        <Link to={s.link} className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">Ochish <ArrowRight className="size-3" /></Link>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {s.kpis.map((k) => <KpiTile key={k.key} k={k} />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">{BODY[s.key]?.(s)}</div>
    </section>
  );
}

const ser = (pairs: [string, string][]): Series[] => pairs.map(([key, label]) => ({ key, label }));
const L = (s: DashSection, k: string) => (s.lists[k] ?? []) as Row[];

const BODY: Record<DashSection["key"], (s: DashSection) => ReactNode> = {
  sales: (s) => (
    <>
      <Block title="Sotuv, oylar bo'yicha" wide><MonthBars rows={s.series.sales} series={ser([["amount", "Shartnomalar summasi"]])} /></Block>
      <Block title="Eng katta mijozlar">
        <RankBars rows={L(s, "top_clients").map((c) => ({ key: n(c.id), label: c.name, value: n(c.amount), sub: `${c.count} ta`, to: `/clients/${c.id}` }))} />
      </Block>
      <Block title="Loyihalar holati" wide>
        <div className="flex flex-wrap gap-2">
          {L(s, "statuses").filter((r) => n(r.count)).map((r) => (
            <Link key={String(r.key)} to={`/projects?status=${r.key}`}
              className="press inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs hover:border-accent">
              {r.label} <b className="tabular">{r.count}</b>
            </Link>
          ))}
        </div>
      </Block>
    </>
  ),
  crm: (s) => (
    <>
      <Block title="Lidlar, oylar bo'yicha" wide>
        <MonthBars rows={s.series.leads} unit="ta" series={ser([["new", "Yangi"], ["won", "Yutilgan"]])} />
      </Block>
      <Block title="Ochiq lidlar bosqichlarda">
        <RankBars unit="ta" rows={L(s, "stages").map((r, i) => ({ key: i, label: r.label, value: n(r.count), sub: n(r.budget) ? money(r.budget) : undefined }))} />
      </Block>
    </>
  ),
  procurement: (s) => (
    <>
      <Block title="Kirim (KR), oylar bo'yicha" wide><MonthBars rows={s.series.purchases} series={ser([["amount", "Kirim summasi"]])} /></Block>
      <Block title="Eng katta yetkazib beruvchilar (12 oy)">
        <RankBars rows={L(s, "top_suppliers").map((r) => ({ key: n(r.id), label: r.name, value: n(r.amount), to: `/procurement/suppliers/${r.id}` }))} />
      </Block>
    </>
  ),
  finance: (s) => (
    <>
      <Block title="Pul oqimi, oylar bo'yicha" wide><MonthBars rows={s.series.cash} series={ser([["in", "Kirim"], ["out", "Chiqim"]])} /></Block>
      <Block title="Hisoblardagi qoldiq">
        <ul className="grid gap-1.5 text-sm">
          {L(s, "accounts").map((a, i) => (
            <li key={i} className="flex items-baseline gap-2 border-b border-line pb-1.5 last:border-0">
              <span className="flex-1 truncate">{a.name}</span>
              <b className="tabular font-medium">{money(a.balance)}</b><span className="text-xs text-muted">{a.currency === "UZS" ? "so'm" : a.currency}</span>
            </li>
          ))}
        </ul>
      </Block>
    </>
  ),
  accounting: (s) => (
    <Block title="Daromad va sotilgan tannarx, oylar bo'yicha" wide>
      <MonthBars rows={s.series.pnl} series={ser([["revenue", "Daromad (90xx)"], ["cost", "Tannarx (9110)"]])} />
    </Block>
  ),
  inventory: (s) => (
    <>
      <Block title="Ombor harakatlari, oylar bo'yicha" wide>
        <MonthBars rows={s.series.moves} series={ser([["kirim", "Kirim"], ["chiqim", "Chiqim"], ["yetkazish", "Yetkazish"]])} />
      </Block>
      <Block title="Qoldiq turkumlar bo'yicha">
        <RankBars rows={L(s, "by_category").map((r) => ({ key: String(r.key), label: CATEGORY[r.key as keyof typeof CATEGORY] ?? r.label, value: n(r.value),
          to: `/inventory/stock?category=${r.key}` }))} />
      </Block>
      <Block title="Eng qimmat qoldiqlar" wide>
        <RankBars rows={L(s, "top_products").map((p) => ({ key: n(p.id), label: p.name, value: n(p.value), sub: `${n(p.qty).toLocaleString("ru-RU")} ${p.unit}`,
          to: `/inventory/products/${p.id}` }))} />
      </Block>
      <Block title="60 kun harakatsiz">
        <RankBars empty="Hammasi harakatda" rows={L(s, "idle").map((p) => ({ key: n(p.id), label: p.name, value: n(p.value), sub: `${n(p.qty).toLocaleString("ru-RU")} ${p.unit}`,
          to: `/inventory/moves?product=${p.id}` }))} />
      </Block>
    </>
  ),
  hr: (s) => (
    <>
      <Block title="Ishga olinganlar, oylar bo'yicha" wide><MonthBars rows={s.series.hired} unit="kishi" series={ser([["n", "Ishga olingan"]])} /></Block>
      <Block title="Bo'limlar">
        <RankBars unit="kishi" rows={L(s, "departments").map((r, i) => ({ key: i, label: r.label, value: n(r.count), to: `/employees?department=${r.label}` }))} />
      </Block>
    </>
  ),
};
