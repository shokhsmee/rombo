import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { Select } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtMoney } from "@/lib/format";

import { suppliersApi, type Supplier } from "./api";

function Balance({ s }: { s: Supplier }) {
  const b = Number(s.balance_uzs);
  if (!b) return <span className="text-muted">0</span>;
  return (
    <span className={b > 0 ? "font-medium text-bad" : "font-medium text-ok"}>
      {b > 0 ? "qarz " : "avans "}{fmtMoney(Math.abs(b))}
      {s.balance_cur && Number(s.balance_cur) ? <span className="block text-2xs text-muted">{fmtMoney(Math.abs(Number(s.balance_cur)), s.price_currency)}</span> : null}
    </span>
  );
}

const columns: Column<Supplier>[] = [
  { key: "code", title: "Kod", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "name", title: "Yetkazib beruvchi", sort: "name",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted">{r.tin && <>STIR <span className="tabular">{r.tin}</span> · </>}{r.price_currency === "USD" ? "USD narxlar" : "so'm narxlar"}</div>
      </div>
    ) },
  { key: "contact", title: "Aloqa",
    render: (r) => (
      <div className="whitespace-nowrap">
        <div className="tabular">{r.phone || <span className="text-muted">—</span>}</div>
        <div className="text-xs text-muted">{[r.contact_person, r.email].filter(Boolean).join(" · ")}</div>
      </div>
    ) },
  { key: "terms", title: "Shartlar", className: "whitespace-nowrap text-xs text-muted",
    render: (r) => [r.prepay_percent != null ? `avans ${r.prepay_percent}%` : null, r.credit_days != null ? `${r.credit_days} kun` : null].filter(Boolean).join(" · ") || "—" },
  { key: "orders", title: "Buyurtmalar", align: "right", render: (r) => r.orders_count },
  { key: "balance", title: "Saldo, so'm", align: "right", render: (r) => <Balance s={r} /> },
  { key: "active", title: "Holat", render: (r) => <ActivePill active={r.is_active} /> },
];

export function SuppliersListPage() {
  const can = useCan("suppliers");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "name" });
  const sel = useSelection(query);
  const list = suppliersApi.useList(query);
  const f = params.filters;

  return (
    <>
      <PageHeader title="Yetkazib beruvchilar" lede="AKFA, oyna zavodi, furnitura — rekvizitlar, shartlar va jurnaldan hisoblangan saldo."
        action={can.create && (
          <Link to="/procurement/suppliers/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi yetkazib beruvchi
          </Link>
        )} />
      <Toolbar action={<ExcelMenu resource="procurement/suppliers" query={query} selection={sel} />}>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Nom, STIR, telefon, email…" />
        <Select className="w-40" value={(f.price_currency as string) || ""} onChange={(e) => update({ filters: { price_currency: e.target.value || null } })}>
          <option value="">Valyuta: barchasi</option>
          <option value="UZS">so'm</option>
          <option value="USD">USD</option>
        </Select>
        <Select className="w-36" value={(f.is_active as string) || ""} onChange={(e) => update({ filters: { is_active: e.target.value || null } })}>
          <option value="">Holat: barchasi</option>
          <option value="true">Faol</option>
          <option value="false">Nofaol</option>
        </Select>
      </Toolbar>
      <BulkBar resource="procurement/suppliers" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="procurement/suppliers" onRowClick={(r) => navigate(`/procurement/suppliers/${r.id}`)} />
    </>
  );
}
