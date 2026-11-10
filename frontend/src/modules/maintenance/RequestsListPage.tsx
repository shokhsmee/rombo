import { Info, Plus, ShieldCheck, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill, Select, Toggle } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate, fmtDateTime } from "@/lib/format";

import { requestsApi, useBots, useRequestSummary, type RequestListItem } from "./api";
import { KIND, PAGE_REQUESTS, PIPELINE, SOURCE, STATUS, type RequestKind, type RequestSource, type RequestStatus } from "./labels";

export function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-3.5 ${i <= value ? "fill-current text-warn" : "text-line-strong"}`} strokeWidth={1.75} />
      ))}
    </span>
  );
}

const columns: Column<RequestListItem>[] = [
  { key: "code", title: "Kod", sort: "code",
    render: (r) => (
      <div className="whitespace-nowrap">
        <div className="font-mono text-xs">{r.code}</div>
        <div className="text-2xs text-muted">{fmtDate(r.created_at)} · {SOURCE[r.source]}</div>
      </div>
    ) },
  { key: "client", title: "Mijoz",
    render: (r) => (
      <div className="min-w-44">
        <div className="font-medium">{r.client.name}</div>
        <div className="text-xs text-muted">{r.project ? r.project.code : r.phone || "—"}</div>
      </div>
    ) },
  { key: "kind", title: "Muammo",
    render: (r) => (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {KIND[r.kind]}
        {r.is_warranty && <span title="Kafolat"><ShieldCheck className="size-3.5 text-ok" strokeWidth={1.75} /></span>}
      </div>
    ) },
  { key: "address", title: "Manzil", render: (r) => <div className="max-w-56 truncate text-xs">{r.address || <span className="text-muted">—</span>}</div> },
  { key: "master", title: "Usta",
    render: (r) => r.master ? (
      <div className="whitespace-nowrap">
        <div>{r.master.name}</div>
        {r.scheduled_at && <div className="text-xs text-muted">{fmtDateTime(r.scheduled_at)}</div>}
      </div>
    ) : <span className="text-muted">—</span> },
  { key: "preferred", title: "Qulay sana", className: "whitespace-nowrap text-xs", render: (r) => fmtDate(r.preferred_date) },
  { key: "rating", title: "Baho", render: (r) => <Stars value={r.rating} /> },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill> },
];

const chip = (on: boolean) =>
  `press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
    on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"}`;

export function RequestsListPage() {
  const can = useCan(PAGE_REQUESTS);
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" });
  const list = requestsApi.useList(query);
  const summary = useRequestSummary();
  const bots = useBots();

  const status = (params.filters.status as string) || "";
  const open = params.filters.open === "1";
  const counts = Object.fromEntries((summary.data ?? []).map((s) => [s.status, s.count])) as Record<string, number>;
  const openCount = (["new", "assigned", "accepted", "in_progress", "done"] as RequestStatus[]).reduce((n, s) => n + (counts[s] ?? 0), 0);
  const off = [
    bots.data && !bots.data.client.enabled && "Mijoz boti sozlanmagan: SERVICE_CLIENT_BOT_TOKEN",
    bots.data && !bots.data.master.enabled && "Usta boti sozlanmagan: SERVICE_MASTER_BOT_TOKEN",
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="Servis arizalari" lede="Sotuvdan keyingi xizmat: mijoz murojaati, usta, bajarilgan ish va baho."
        action={can.create && (
          <Link to="/service/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi ariza
          </Link>
        )} />

      {off.length > 0 && (
        <p className="-mt-3 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <Info className="size-3.5 shrink-0" strokeWidth={1.75} />
          {off.map((t) => <span key={t}>{t}</span>)}
        </p>
      )}

      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
        <button type="button" onClick={() => update({ filters: { status: null, open: null } })}
          className={`press shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${!status && !open ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
          Barchasi
        </button>
        <button type="button" onClick={() => update({ filters: { status: null, open: open ? null : "1" } })} className={chip(open)}>
          Ochiq <span className="tabular opacity-60">{openCount}</span>
        </button>
        {[...PIPELINE, "cancelled" as RequestStatus].map((s) => (
          <button key={s} type="button" onClick={() => update({ filters: { status: status === s ? null : s, open: null } })} className={chip(status === s)}>
            {STATUS[s].label}
            <span className="tabular opacity-60">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Kod, mijoz, telefon, manzil, usta…" />
        <Select className="w-48" value={(params.filters.kind as string) || ""} onChange={(e) => update({ filters: { kind: e.target.value || null } })}>
          <option value="">Turi: barchasi</option>
          {(Object.entries(KIND) as [RequestKind, string][]).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <EntitySelect endpoint="maintenance/masters" placeholder="Usta" className="w-48"
          value={params.filters.master ? Number(params.filters.master) : null}
          onChange={(id) => update({ filters: { master: id ? String(id) : null } })} />
        <EntitySelect endpoint="clients" placeholder="Mijoz" className="w-52"
          value={params.filters.client ? Number(params.filters.client) : null}
          onChange={(id) => update({ filters: { client: id ? String(id) : null } })} />
        <Select className="w-40" value={(params.filters.source as string) || ""} onChange={(e) => update({ filters: { source: e.target.value || null } })}>
          <option value="">Manba: barchasi</option>
          {(Object.entries(SOURCE) as [RequestSource, string][]).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <Toggle label="Kafolat" checked={params.filters.is_warranty === "true"}
          onChange={(v) => update({ filters: { is_warranty: v ? "true" : null } })} />
      </Toolbar>

      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="service" onRowClick={(r) => navigate(`/service/${r.id}`)}
        empty="Arizalar yo'q" />
    </>
  );
}
