import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { Segmented, Select } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";

import { clientsApi, KIND_LABEL, REGIONS, type ClientListItem } from "./api";

const columns: Column<ClientListItem>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "name", title: "Mijoz", sort: "name",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted">{KIND_LABEL[r.kind]}{r.segment && <> · {r.segment.name}</>}{r.tin && <> · STIR <span className="tabular">{r.tin}</span></>}</div>
      </div>
    ) },
  { key: "phone", title: "Aloqa",
    render: (r) => (
      <div className="whitespace-nowrap">
        <div className="tabular">{r.phone || <span className="text-muted">—</span>}</div>
        {r.contact_person && <div className="text-xs text-muted">{r.contact_person}</div>}
      </div>
    ) },
  { key: "region", title: "Hudud", sort: "region", className: "whitespace-nowrap text-xs", render: (r) => r.region || <span className="text-muted">—</span> },
  { key: "manager", title: "Menejer", className: "whitespace-nowrap text-xs", render: (r) => r.manager?.name ?? <span className="text-muted">—</span> },
  { key: "active", title: "Holat", render: (r) => <ActivePill active={r.is_active} /> },
];

export function ClientsListPage() {
  const can = useCan("clients");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" });
  const sel = useSelection(query);
  const list = clientsApi.useList(query);
  const f = params.filters;

  return (
    <>
      <PageHeader title="Mijozlar" lede="Jismoniy, yuridik shaxslar va dilerlar."
        action={can.create && (
          <Link to="/clients/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi mijoz
          </Link>
        )} />
      <Toolbar action={<ExcelMenu resource="clients" query={query} selection={sel} />}>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Nom, STIR, telefon…" />
        <Segmented value={(f.kind as string) || ""} onChange={(k) => update({ filters: { kind: k || null } })}
          options={[{ value: "", label: "Barchasi" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Select className="w-44" value={(f.region as string) || ""} onChange={(e) => update({ filters: { region: e.target.value || null } })}>
          <option value="">Hudud: barchasi</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <EntitySelect endpoint="employees" placeholder="Menejer" className="w-52"
          value={f.manager ? Number(f.manager) : null}
          onChange={(id) => update({ filters: { manager: id ? String(id) : null } })} />
        <Select className="w-36" value={(f.is_active as string) || ""} onChange={(e) => update({ filters: { is_active: e.target.value || null } })}>
          <option value="">Holat: barchasi</option>
          <option value="true">Faol</option>
          <option value="false">Nofaol</option>
        </Select>
      </Toolbar>
      <BulkBar resource="clients" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="clients" onRowClick={(r) => navigate(`/clients/${r.id}`)} />
    </>
  );
}
