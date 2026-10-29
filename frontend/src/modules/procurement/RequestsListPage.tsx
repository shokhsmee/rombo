import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill, Toggle } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";

import { requestsApi, useStatusSummary, type RequestListItem, type RequestStatus } from "./api";
import { StatusChips } from "./StatusChips";
import { REQUEST_PIPELINE, REQUEST_STATUS } from "./statuses";

const columns: Column<RequestListItem>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "project", title: "Loyiha",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.project.name}</div>
        <div className="font-mono text-xs text-muted">{r.project.code}</div>
      </div>
    ) },
  { key: "requester", title: "So'rovchi", className: "whitespace-nowrap text-xs", render: (r) => r.requester?.full_name ?? <span className="text-muted">—</span> },
  { key: "needed_by", title: "Kerak sana", sort: "needed_by", className: "whitespace-nowrap", render: (r) => fmtDate(r.needed_by) },
  { key: "lines", title: "Qatorlar", align: "right", render: (r) => r.lines_count },
  { key: "created", title: "Yaratildi", sort: "created_at", className: "whitespace-nowrap text-xs text-muted", render: (r) => fmtDate(r.created_at) },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Pill> },
];

export function RequestsListPage() {
  const can = useCan("procurement");
  const canOrders = useCan("purchase_orders");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" }, ["status"]);
  const list = requestsApi.useList(query);
  const summary = useStatusSummary("requests");
  const selected = (params.filters.status as string[] | undefined) ?? [];
  const counts = Object.fromEntries((summary.data ?? []).map((s) => [s.status, s.count])) as Record<string, number>;
  const project = params.filters.project as string | undefined;

  return (
    <>
      <PageHeader title="Xarid so'rovlari" lede="Loyiha uchun nima kerak — hisob-kitobdan yoki qo'lda; tasdiqdan keyin buyurtmaga aylanadi."
        action={<>
          {project && canOrders.view && (
            <Link to={`/procurement/orders?project=${project}`} className="text-sm text-accent-ink hover:underline">Shu loyiha buyurtmalari →</Link>
          )}
          {can.create && (
            <Link to={`/procurement/requests/new${project ? `?project=${project}` : ""}`}
              className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
              <Plus className="size-4" /> Yangi so'rov
            </Link>
          )}
        </>} />

      <StatusChips statuses={[...REQUEST_PIPELINE, "rejected", "cancelled"] as RequestStatus[]} map={REQUEST_STATUS}
        selected={selected} counts={counts} onClear={() => update({ filters: { status: [] } })}
        onToggle={(s) => update({ filters: { status: selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s] } })} />

      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Kod, loyiha, material…" />
        <EntitySelect endpoint="projects" placeholder="Loyiha" className="w-60"
          value={project ? Number(project) : null}
          onChange={(id) => update({ filters: { project: id ? String(id) : null } })} />
        <Toggle label="Tasdiq kutmoqda" checked={params.filters.needs_approval === "true"}
          onChange={(v) => update({ filters: { needs_approval: v ? "true" : null } })} />
      </Toolbar>

      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="procurement/requests" onRowClick={(r) => navigate(`/procurement/requests/${r.id}`)} />
    </>
  );
}
