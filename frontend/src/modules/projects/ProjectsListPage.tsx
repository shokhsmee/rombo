import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill, Toggle } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtArea, fmtDate, fmtMoney, isOverdue } from "@/lib/format";

import { projectsApi, useProjectSummary, type ProjectListItem, type ProjectStatus } from "./api";
import { FINISHED, PIPELINE, STATUS } from "./statuses";

const columns: Column<ProjectListItem>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "name", title: "Loyiha", sort: "name",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted">{r.client.name}</div>
      </div>
    ) },
  { key: "manager", title: "Sotuvchi", className: "whitespace-nowrap text-xs", render: (r) => r.manager?.name ?? <span className="text-muted">—</span> },
  { key: "deadline", title: "Muddat", sort: "deadline", className: "whitespace-nowrap",
    render: (r) => {
      const late = isOverdue(r.deadline, FINISHED.includes(r.status));
      return <span className={late ? "font-medium text-bad" : ""}>{fmtDate(r.deadline)}</span>;
    } },
  { key: "area", title: "m²", align: "right", render: (r) => (Number(r.total_area) ? fmtArea(r.total_area).replace(" m²", "") : <span className="text-muted">—</span>) },
  { key: "amount", title: "Summa", sort: "amount", align: "right", render: (r) => fmtMoney(r.amount, r.currency) },
  { key: "debt", title: "Qarz", align: "right",
    render: (r) => Number(r.debt_amount) > 0
      ? <span className="font-medium text-bad">{fmtMoney(r.debt_amount)}</span>
      : <span className="text-ok">0</span> },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill> },
];

export function ProjectsListPage() {
  const can = useCan("projects");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" }, ["status"]);
  const list = projectsApi.useList(query);
  const summary = useProjectSummary();

  const selected = (params.filters.status as string[] | undefined) ?? [];
  const counts = Object.fromEntries((summary.data ?? []).map((s) => [s.status, s.count])) as Record<string, number>;
  const toggle = (s: ProjectStatus) =>
    update({ filters: { status: selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s] } });

  return (
    <>
      <PageHeader title="Loyihalar" lede="Mijoz buyurtmalari — xarid, MRP va ishlab chiqarish shu yerdan boshlanadi."
        action={can.create && (
          <Link to="/projects/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi loyiha
          </Link>
        )} />

      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
        <button type="button" onClick={() => update({ filters: { status: [] } })}
          className={`press shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${selected.length ? "border-line bg-surface text-muted hover:text-ink" : "border-ink bg-ink text-on-ink"}`}>
          Barchasi
        </button>
        {[...PIPELINE, "cancelled" as ProjectStatus].map((s) => {
          const on = selected.includes(s);
          return (
            <button key={s} type="button" onClick={() => toggle(s)}
              className={`press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
              {STATUS[s].label}
              <span className="tabular opacity-60">{counts[s] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Kod, nom, mijoz, telefon…" />
        <EntitySelect endpoint="clients" placeholder="Mijoz" className="w-56"
          value={params.filters.client ? Number(params.filters.client) : null}
          onChange={(id) => update({ filters: { client: id ? String(id) : null } })} />
        <EntitySelect endpoint="employees" placeholder="Menejer" className="w-52"
          value={params.filters.manager ? Number(params.filters.manager) : null}
          onChange={(id) => update({ filters: { manager: id ? String(id) : null } })} />
        <Toggle label="Muddati o'tgan" checked={params.filters.overdue === "true"}
          onChange={(v) => update({ filters: { overdue: v ? "true" : null } })} />
      </Toolbar>

      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="projects" onRowClick={(r) => navigate(`/projects/${r.id}`)} />
    </>
  );
}
