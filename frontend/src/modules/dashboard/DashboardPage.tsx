import { AlarmClock, ArrowRight, CalendarClock } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Kpi, Pill } from "@/components/ui";
import { fmtDate, fmtMoney } from "@/lib/format";
import { projectsApi, useProjectSummary, type ProjectListItem, type ProjectStatus } from "@/modules/projects/api";
import { STATUS } from "@/modules/projects/statuses";

const ACTIVE: ProjectStatus[] = ["confirmed", "procurement", "production", "ready"];
const TILES: ProjectStatus[] = ["draft", "confirmed", "procurement", "production", "ready", "delivered"];

export function DashboardPage() {
  const { me, can } = useAuth();
  const navigate = useNavigate();
  const canProjects = can("projects");
  const summary = useProjectSummary();
  const overdue = projectsApi.useList({ overdue: "true", size: 6, sort: "deadline" }, { enabled: canProjects });
  const soon = projectsApi.useList({ status: ACTIVE, size: 6, sort: "deadline" }, { enabled: canProjects });
  const counts = Object.fromEntries((summary.data ?? []).map((s) => [s.status, s.count])) as Record<string, number>;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Xayrli tong" : hour < 18 ? "Xayrli kun" : "Xayrli kech";
  const first = me?.full_name.split(" ")[0];

  return (
    <>
      <PageHeader title={`${greet}, ${first}`} lede={canProjects ? "Loyihalar holati va yaqin muddatlar." : undefined} />
      {canProjects && (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {TILES.map((s) => (
              <Kpi key={s} label={<Pill tone={STATUS[s].tone}>{STATUS[s].label}</Pill>} value={counts[s] ?? 0}
                onClick={() => navigate(`/projects?status=${s}`)} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel icon={<AlarmClock className="size-4" />} tone="bg-bad-soft text-bad" title="Muddati o'tgan"
              link="/projects?overdue=true" items={overdue.data?.items} late empty="Muddati o'tgan loyiha yo'q" />
            <Panel icon={<CalendarClock className="size-4" />} tone="bg-accent-soft text-accent-ink" title="Jarayonda — muddat bo'yicha"
              link={`/projects?${ACTIVE.map((s) => `status=${s}`).join("&")}&sort=deadline`} items={soon.data?.items}
              empty="Jarayonda loyiha yo'q" />
          </div>
        </div>
      )}
    </>
  );
}

function Panel({ icon, tone, title, link, items, late, empty }: {
  icon: ReactNode; tone: string; title: string; link: string; items?: ProjectListItem[]; late?: boolean; empty: string;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className={`grid size-7 place-items-center rounded-lg ${tone}`}>{icon}</span>
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        <Link to={link} className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">Barchasi <ArrowRight className="size-3" /></Link>
      </header>
      {items?.map((p) => (
        <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-ground">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{p.name}</div>
            <div className="truncate text-xs text-muted"><span className="font-mono">{p.code}</span> · {p.client.name}</div>
          </div>
          <div className="text-right">
            <div className={`text-sm tabular ${late ? "font-medium text-bad" : ""}`}>{fmtDate(p.deadline)}</div>
            <div className="text-xs tabular text-muted">{fmtMoney(p.amount, p.currency)}</div>
          </div>
        </Link>
      ))}
      {items && items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">{empty}</p>}
    </section>
  );
}
