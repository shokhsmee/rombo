import { useNavigate } from "react-router-dom";

import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate, fmtMoney } from "@/lib/format";

import { receiptsApi, useStatusSummary, type ReceiptListItem, type ReceiptStatus } from "./api";
import { StatusChips } from "./StatusChips";
import { RECEIPT_PIPELINE, RECEIPT_STATUS } from "./statuses";

const columns: Column<ReceiptListItem>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "supplier", title: "Yetkazib beruvchi",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.supplier.name}</div>
        <div className="font-mono text-xs text-muted">{r.order.code}</div>
      </div>
    ) },
  { key: "date", title: "Sana", sort: "date", className: "whitespace-nowrap", render: (r) => fmtDate(r.date) },
  { key: "invoice", title: "Hisob-faktura", className: "whitespace-nowrap text-xs", render: (r) => r.invoice_number || <span className="text-muted">—</span> },
  { key: "storekeeper", title: "Omborchi", className: "whitespace-nowrap text-xs", render: (r) => r.storekeeper?.full_name ?? <span className="text-muted">—</span> },
  { key: "gross", title: "Jami", align: "right", render: (r) => fmtMoney(r.totals.gross, r.currency) },
  { key: "gross_uzs", title: "so'm", align: "right", render: (r) => (r.currency === "UZS" ? <span className="text-muted">—</span> : fmtMoney(r.totals.gross_uzs)) },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={RECEIPT_STATUS[r.status].tone}>{RECEIPT_STATUS[r.status].label}</Pill> },
];

export function ReceiptsListPage() {
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" }, ["status"]);
  const list = receiptsApi.useList(query);
  const summary = useStatusSummary("receipts");
  const selected = (params.filters.status as string[] | undefined) ?? [];
  const counts = Object.fromEntries((summary.data ?? []).map((s) => [s.status, s.count])) as Record<string, number>;

  return (
    <>
      <PageHeader title="Kirim" lede="Yetkazib beruvchidan kelgan tovar — buyurtma narxida, hisob-faktura bilan; o'tkazilganda jurnalga yoziladi." />

      <StatusChips statuses={[...RECEIPT_PIPELINE, "cancelled"] as ReceiptStatus[]} map={RECEIPT_STATUS}
        selected={selected} counts={counts} onClear={() => update({ filters: { status: [] } })}
        onToggle={(s) => update({ filters: { status: selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s] } })} />

      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Kod, buyurtma, hisob-faktura…" />
        <EntitySelect endpoint="procurement/suppliers" placeholder="Yetkazib beruvchi" className="w-56"
          value={params.filters.supplier ? Number(params.filters.supplier) : null}
          onChange={(id) => update({ filters: { supplier: id ? String(id) : null } })} />
        <EntitySelect endpoint="projects" placeholder="Loyiha" className="w-60"
          value={params.filters.project ? Number(params.filters.project) : null}
          onChange={(id) => update({ filters: { project: id ? String(id) : null } })} />
      </Toolbar>

      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="procurement/receipts" onRowClick={(r) => navigate(`/procurement/receipts/${r.id}`)}
        empty={params.filters.order ? "Bu buyurtma bo'yicha kirim yo'q" : undefined} />
    </>
  );
}
