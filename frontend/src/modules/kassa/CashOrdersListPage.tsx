import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Button, Input, Menu, Pill, Segmented, Select } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";
import { money } from "@/modules/accounting/labels";

import { ordersApi, useCashAccounts, usePurposes, type CashOrderListItem, type OrderKind, type OrderStatus } from "./api";
import { ORDER_KIND, ORDER_STATUS, unit } from "./labels";

const KindIcon = ({ kind }: { kind: OrderKind }) =>
  kind === "in" ? <ArrowDownLeft className="size-4 text-ok" strokeWidth={2} />
    : kind === "out" ? <ArrowUpRight className="size-4 text-bad" strokeWidth={2} />
      : <ArrowLeftRight className="size-4 text-muted" strokeWidth={2} />;

const columns: Column<CashOrderListItem>[] = [
  { key: "code", title: "№", sort: "code", className: "whitespace-nowrap font-mono text-xs",
    render: (r) => r.code ?? <span className="text-muted">qoralama</span> },
  { key: "date", title: "Sana", sort: "date", className: "whitespace-nowrap", render: (r) => fmtDate(r.date) },
  { key: "kind", title: "Turi", className: "whitespace-nowrap",
    render: (r) => <span className="inline-flex items-center gap-1.5 text-xs"><KindIcon kind={r.kind} />{ORDER_KIND[r.kind]}</span> },
  { key: "who", title: "Kontragent / maqsad",
    render: (r) => (
      <div className="min-w-56">
        <div className="font-medium">{r.partner?.name ?? r.employee?.name ?? (r.kind === "transfer" ? `${r.account.name} → ${r.to_account?.name}` : <span className="text-muted">—</span>)}</div>
        <div className="text-xs text-muted">{r.purpose?.name}{r.project && <> · {r.project.code}</>}{r.basis && <> · {r.basis}</>}</div>
      </div>
    ) },
  { key: "account", title: "Kassa / bank", className: "whitespace-nowrap text-xs text-muted", render: (r) => r.account.name },
  { key: "amount", title: "Summa", sort: "amount", align: "right",
    render: (r) => (
      <span className={`font-medium ${r.kind === "in" ? "text-ok" : r.kind === "out" ? "text-bad" : ""}`}>
        {r.kind === "out" ? "−" : r.kind === "in" ? "+" : ""}{money(r.amount)} {r.currency !== "UZS" && unit(r.currency)}
      </span>
    ) },
  { key: "entry", title: "O'tkazma", className: "whitespace-nowrap font-mono text-xs text-muted", render: (r) => r.entry_code ?? "—" },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={ORDER_STATUS[r.status].tone}>{ORDER_STATUS[r.status].label}</Pill> },
];

export function CashOrdersListPage() {
  const can = useCan("cash_orders");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-date" }, ["status"]);
  const sel = useSelection(query);
  const list = ordersApi.useList(query);
  const accounts = useCashAccounts({}, useCan("kassa").view);
  const purposes = usePurposes();
  const f = params.filters;
  const statuses = (f.status as string[] | undefined) ?? [];
  const toggle = (s: OrderStatus) => update({ filters: { status: statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s] } });

  return (
    <>
      <PageHeader title="Kirim / chiqim" lede="PKO, RKO, bank kirimlari, to'lov topshiriqnomalari va o'tkazmalar. O'tkazish jurnalga yozadi; bekor qilish storno qiladi."
        action={can.create && (
          <>
            <Button onClick={() => navigate("/kassa/orders/new?kind=in")}><Plus className="size-4" /> Kirim</Button>
            <Menu align="right"
              trigger={() => <Button variant="ghost">Boshqa <ChevronDown className="size-3.5" /></Button>}
              items={[
                { label: "Chiqim (RKO / to'lov)", icon: <ArrowUpRight className="size-4 text-bad" />, onClick: () => navigate("/kassa/orders/new?kind=out") },
                { label: "Hisoblar orasida o'tkazma", icon: <ArrowLeftRight className="size-4 text-muted" />, onClick: () => navigate("/kassa/orders/new?kind=transfer") },
              ]} />
          </>
        )} />
      <Toolbar action={<ExcelMenu resource="kassa/orders" query={query} selection={sel} />}>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="№, kontragent, loyiha, asos…" />
        <Segmented value={(f.kind as string) || ""} onChange={(k) => update({ filters: { kind: k || null } })}
          options={[{ value: "", label: "Barchasi" }, ...(Object.keys(ORDER_KIND) as OrderKind[]).map((k) => ({ value: k, label: ORDER_KIND[k] }))]} />
        <div className="flex gap-1">
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)}
              className={`press rounded-full border px-3 py-1 text-xs font-medium ${statuses.includes(s) ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
              {ORDER_STATUS[s].label}
            </button>
          ))}
        </div>
        {accounts.data && (
          <Select className="w-44" value={(f.account as string) || ""} onChange={(e) => update({ filters: { account: e.target.value || null } })}>
            <option value="">Barcha hisoblar</option>
            {accounts.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        )}
        <Select className="w-48" value={(f.purpose as string) || ""} onChange={(e) => update({ filters: { purpose: e.target.value || null } })}>
          <option value="">Barcha maqsadlar</option>
          {(purposes.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <EntitySelect endpoint="clients" placeholder="Kontragent" className="w-48"
          value={f.partner ? Number(f.partner) : null} onChange={(id) => update({ filters: { partner: id ? String(id) : null } })} />
        <EntitySelect endpoint="projects" placeholder="Loyiha" className="w-48"
          value={f.project ? Number(f.project) : null} onChange={(id) => update({ filters: { project: id ? String(id) : null } })} />
        <Input type="date" className="w-40" value={(f.date_from as string) || ""} onChange={(e) => update({ filters: { date_from: e.target.value || null } })} />
        <Input type="date" className="w-40" value={(f.date_to as string) || ""} onChange={(e) => update({ filters: { date_to: e.target.value || null } })} />
      </Toolbar>
      <BulkBar resource="kassa/orders" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="cash-orders" onRowClick={(r) => navigate(`/kassa/orders/${r.id}`)} />
    </>
  );
}
