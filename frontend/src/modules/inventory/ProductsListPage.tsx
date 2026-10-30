import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { Button, Segmented } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { money } from "@/modules/accounting/labels";

import { productsApi, type Category, type Product } from "./api";
import { CATEGORY, qty } from "./labels";

const columns: Column<Product>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "name", title: "Nomi", sort: "name", render: (r) => <div><div className="font-medium">{r.name}</div>{r.sku && <div className="text-xs text-muted">{r.sku}</div>}</div> },
  { key: "category", title: "Turkum", sort: "category", className: "whitespace-nowrap text-xs text-muted", render: (r) => CATEGORY[r.category] },
  { key: "qty", title: "Qoldiq", align: "right", className: "whitespace-nowrap tabular",
    render: (r) => <><b className="font-medium">{qty(r.qty_on_hand)}</b> <span className="text-xs text-muted">{r.unit}</span></> },
  { key: "avg", title: "O'rtacha tannarx", align: "right", className: "whitespace-nowrap tabular text-muted", render: (r) => money(r.avg_cost ?? r.default_cost) },
  { key: "value", title: "Qiymat, so'm", align: "right", className: "whitespace-nowrap tabular font-medium", render: (r) => money(r.value_on_hand) },
  { key: "active", title: "Holat", render: (r) => <ActivePill active={r.is_active} /> },
];

export function ProductsListPage() {
  const can = useCan("products");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "name" });
  const sel = useSelection(query);
  const list = productsApi.useList(query);
  const cat = (params.filters.category as string) || "";

  return (
    <>
      <PageHeader title="Mahsulotlar" lede="Profil, oyna, furnitura va tayyor mahsulotlar. Ta'minot kirimi noma'lum tovarni o'zi qo'shadi."
        action={can.create && <Button onClick={() => navigate("/inventory/products/new")}><Plus className="size-4" strokeWidth={1.75} /> Mahsulot</Button>} />
      <Toolbar action={<ExcelMenu resource="inventory/products" query={query} selection={sel} />}>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Nomi, artikul, kod…" />
        <Segmented value={cat} onChange={(c) => update({ filters: { category: c || null } })}
          options={[{ value: "", label: "Barchasi" }, ...(Object.keys(CATEGORY) as Category[]).map((k) => ({ value: k, label: CATEGORY[k] }))]} />
      </Toolbar>
      <BulkBar resource="inventory/products" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="inventory-products" onRowClick={(r) => navigate(`/inventory/products/${r.id}`)} />
    </>
  );
}
