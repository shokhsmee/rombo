import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { useListParams } from "@/hooks/useListParams";

import { pricingApi, type PriceListItem } from "./api";

const columns: Column<PriceListItem>[] = [
  { key: "name", title: "Narx ro'yxati", sort: "name",
    render: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted">{r.product_type?.name ?? "—"}{r.bar_length_m && ` · profil ${Number(r.bar_length_m)} m`}</div>
      </div>
    ) },
  { key: "currency", title: "Valyuta", render: (r) => r.currency },
  { key: "items", title: "Qatorlar", align: "right", render: (r) => r.items_count },
  { key: "active", title: "Holat", render: (r) => <ActivePill active={r.is_active} /> },
];

export function PriceListsPage() {
  const can = useCan("pricing");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "name" });
  const sel = useSelection(query);
  const list = pricingApi.useList(query);
  return (
    <>
      <PageHeader title="Narxlar" lede="Har bir seriya uchun komplektlovchilar va narxlar. Loyihaning hisob-kitobi shulardan tuziladi."
        action={can.create && (
          <Link to="/settings/pricing/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi narx ro'yxati
          </Link>
        )} />
      <Toolbar action={<ExcelMenu resource="pricing" query={query} selection={sel} />}><SearchInput value={params.q} onChange={(q) => update({ q })} /></Toolbar>
      <BulkBar resource="pricing" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="pricing" onRowClick={(r) => navigate(`/settings/pricing/${r.id}`)} />
    </>
  );
}
