import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Input, Pill, Segmented } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";

import { entriesApi, type EntryListItem, type SourceKind } from "./api";
import { ENTRY_STATUS, money, SOURCE_KIND } from "./labels";

const columns: Column<EntryListItem>[] = [
  { key: "code", title: "№", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "date", title: "Sana", sort: "date", className: "whitespace-nowrap", render: (r) => fmtDate(r.date) },
  { key: "memo", title: "Mazmuni",
    render: (r) => (
      <div className="min-w-56">
        <div className="font-medium">{r.memo || <span className="text-muted">—</span>}</div>
        <div className="text-xs text-muted">{r.source_label || SOURCE_KIND[r.source_kind]}{r.posted_by && <> · {r.posted_by}</>}</div>
      </div>
    ) },
  { key: "kind", title: "Turi", className: "whitespace-nowrap text-xs text-muted", render: (r) => SOURCE_KIND[r.source_kind] },
  { key: "total", title: "Summa", sort: "total_debit", align: "right", render: (r) => <span className="font-medium">{money(r.total_debit)}</span> },
  { key: "status", title: "Holat",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <Pill tone={ENTRY_STATUS[r.status].tone}>{ENTRY_STATUS[r.status].label}</Pill>
        {r.reversed_by_code && <span className="font-mono text-2xs text-muted">{r.reversed_by_code}</span>}
      </span>
    ) },
];

export function JournalListPage() {
  const can = useCan("accounting");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-date" });
  const list = entriesApi.useList(query);
  const f = params.filters;

  return (
    <>
      <PageHeader title="Jurnal" lede="Barcha buxgalteriya o'tkazmalari. Hujjatlar o'zi yozadi; qo'lda — faqat boshlang'ich qoldiq va tuzatishlar."
        action={can.create && (
          <Link to="/accounting/entries/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Qo'lda o'tkazma
          </Link>
        )} />
      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="№, mazmun…" />
        <Segmented value={(f.source_kind as string) || ""} onChange={(k) => update({ filters: { source_kind: k || null } })}
          options={[{ value: "", label: "Barchasi" }, ...(Object.keys(SOURCE_KIND) as SourceKind[]).map((k) => ({ value: k, label: SOURCE_KIND[k] }))]} />
        <Input type="date" className="w-40" value={(f.date_from as string) || ""} onChange={(e) => update({ filters: { date_from: e.target.value || null } })} />
        <Input type="date" className="w-40" value={(f.date_to as string) || ""} onChange={(e) => update({ filters: { date_to: e.target.value || null } })} />
        <EntitySelect endpoint="clients" placeholder="Kontragent" className="w-52"
          value={f.partner ? Number(f.partner) : null} onChange={(id) => update({ filters: { partner: id ? String(id) : null } })} />
      </Toolbar>
      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="accounting-entries" onRowClick={(r) => navigate(`/accounting/entries/${r.id}`)} />
    </>
  );
}
