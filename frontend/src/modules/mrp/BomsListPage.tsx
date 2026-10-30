import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { Button, Segmented } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";
import { CATEGORY } from "@/modules/inventory/labels";

import { bomsApi, type BomListItem } from "./api";

const columns: Column<BomListItem>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "product", title: "Mahsulot",
    render: (r) => <div><div className="font-medium">{r.product.name}</div><div className="text-xs text-muted">{r.product.code} · {CATEGORY[r.product.category]}</div></div> },
  { key: "name", title: "Nomi", sort: "name", render: (r) => r.name },
  { key: "version", title: "Versiya", align: "right", render: (r) => `v${r.version}` },
  { key: "lines", title: "Qatorlar", align: "right", render: (r) => r.lines_count },
  { key: "active", title: "Holat", render: (r) => <ActivePill active={r.is_active} on="Faol" off="Eski versiya" /> },
  { key: "updated", title: "O'zgargan", sort: "updated_at", className: "whitespace-nowrap text-xs text-muted", render: (r) => fmtDate(r.updated_at) },
];

/** Tarkiblar (BOM): what each finished / semi-finished product is made of. */
export function BomsListPage() {
  const can = useCan("bom");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "code" });
  const sel = useSelection(query);
  const list = bomsApi.useList(query);
  const f = params.filters;

  return (
    <>
      <PageHeader title="Tarkiblar (BOM)"
        lede="Har bir tayyor mahsulot nimadan iborat: material, miqdor (bir donaga yoki 1 m² ga) va chiqindi foizi. Loyiha materiallari, hisob-kitob, xarid va chiqim shu yerdan hisoblanadi."
        action={can.create && <Button onClick={() => navigate("/mrp/boms/new")}><Plus className="size-4" strokeWidth={1.75} /> Tarkib</Button>} />
      <Toolbar action={<>
        <ExcelMenu resource="mrp/bom-lines" query={{}} label="Qatorlar Excel" name="tarkib-qatorlari" />
        <ExcelMenu resource="mrp/boms" query={query} selection={sel} />
      </>}>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Kod, mahsulot…" />
        <Segmented value={(f.is_active as string) ?? ""} onChange={(v) => update({ filters: { is_active: v || null } })}
          options={[{ value: "", label: "Barchasi" }, { value: "true", label: "Faol" }, { value: "false", label: "Eski versiyalar" }]} />
        <EntitySelect endpoint="inventory/products" placeholder="Material bo'yicha" className="w-56"
          value={f.component ? Number(f.component) : null} onChange={(id) => update({ filters: { component: id ? String(id) : null } })} />
      </Toolbar>
      <BulkBar resource="mrp/boms" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching}
        params={params} onParams={update} navKey="mrp-boms" onRowClick={(r) => navigate(`/mrp/boms/${r.id}`)}
        empty="Tarkib yo'q. «Tarkib» tugmasi yoki «Qatorlar Excel» → import bilan qo'shing." />
    </>
  );
}
