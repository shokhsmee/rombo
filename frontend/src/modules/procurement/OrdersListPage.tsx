import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate, fmtMoney } from "@/lib/format";

import { ordersApi, useStatusSummary, type OrderListItem, type OrderStatus } from "./api";
import { StatusChips } from "./StatusChips";
import { ORDER_PIPELINE, ORDER_STATUS, VIA_LABEL } from "./statuses";

const columns: Column<OrderListItem>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "supplier", title: "Yetkazib beruvchi",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.supplier.name}</div>
        <div className="text-xs text-muted">{r.project ? `${r.project.code} · ${r.project.name}` : "bir nechta loyiha"}</div>
      </div>
    ) },
  { key: "date", title: "Sana", sort: "date", className: "whitespace-nowrap", render: (r) => fmtDate(r.date) },
  { key: "expected", title: "Kutilmoqda", sort: "expected_date", className: "whitespace-nowrap", render: (r) => fmtDate(r.expected_date) },
  { key: "sent", title: "Yuborildi", className: "whitespace-nowrap text-xs text-muted",
    render: (r) => (r.sent_at ? `${fmtDate(r.sent_at)} · ${r.sent_via ? VIA_LABEL[r.sent_via] : ""}` : "—") },
  { key: "gross", title: "Jami", align: "right", render: (r) => fmtMoney(r.totals.gross, r.currency) },
  { key: "gross_uzs", title: "so'm", align: "right", render: (r) => (r.currency === "UZS" ? <span className="text-muted">—</span> : fmtMoney(r.totals.gross_uzs)) },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={ORDER_STATUS[r.status].tone}>{ORDER_STATUS[r.status].label}</Pill> },
];

export function OrdersListPage() {
  const can = useCan("purchase_orders");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" }, ["status"]);
  const list = ordersApi.useList(query);
  const summary = useStatusSummary("orders");
  const selected = (params.filters.status as string[] | undefined) ?? [];
  const counts = Object.fromEntries((summary.data ?? []).map((s) => [s.status, s.count])) as Record<string, number>;

  return (
    <>
      <PageHeader title="Buyurtmalar" lede="Yetkazib beruvchiga yuborilgan buyurtmalar — nima so'raldi, nima keldi."
        action={can.create && (
          <Link to="/procurement/orders/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi buyurtma
          </Link>
        )} />

      <StatusChips statuses={[...ORDER_PIPELINE, "cancelled"] as OrderStatus[]} map={ORDER_STATUS}
        selected={selected} counts={counts} onClear={() => update({ filters: { status: [] } })}
        onToggle={(s) => update({ filters: { status: selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s] } })} />

      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Kod, yetkazib beruvchi, loyiha…" />
        <EntitySelect endpoint="procurement/suppliers" placeholder="Yetkazib beruvchi" className="w-56"
          value={params.filters.supplier ? Number(params.filters.supplier) : null}
          onChange={(id) => update({ filters: { supplier: id ? String(id) : null } })} />
        <EntitySelect endpoint="projects" placeholder="Loyiha" className="w-60"
          value={params.filters.project ? Number(params.filters.project) : null}
          onChange={(id) => update({ filters: { project: id ? String(id) : null } })} />
      </Toolbar>

      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="procurement/orders" onRowClick={(r) => navigate(`/procurement/orders/${r.id}`)} />
    </>
  );
}
