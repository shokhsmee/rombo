import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, Factory, Plus, Scale, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Button, Input, Kpi, Menu, Pill, Select } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";
import { money } from "@/modules/accounting/labels";

import { movesApi, useMovesSummary, useWarehouses, type MoveStatus, type MoveType, type StockMoveListItem } from "./api";
import { CATEGORY, MOVE_STATUS, MOVE_TYPE, qty } from "./labels";

const TYPE_ICON: Record<MoveType, ReactNode> = {
  receipt: <ArrowDownLeft className="size-4 text-ok" strokeWidth={2} />,
  output: <Factory className="size-4 text-ok" strokeWidth={1.75} />,
  issue: <ArrowUpRight className="size-4 text-bad" strokeWidth={2} />,
  delivery: <Truck className="size-4 text-info" strokeWidth={1.75} />,
  transfer: <ArrowLeftRight className="size-4 text-muted" strokeWidth={2} />,
  adjust: <Scale className="size-4 text-warn" strokeWidth={1.75} />,
};

/** Signed quantity of the row: + in, − out; a transfer reads "A → B". */
function signOf(r: StockMoveListItem): "+" | "−" | "" {
  if (r.type === "receipt" || r.type === "output") return "+";
  if (r.type === "issue" || r.type === "delivery") return "−";
  if (r.type === "adjust") return Number(r.qty) < 0 ? "−" : "+";
  return "";
}

const columns: Column<StockMoveListItem>[] = [
  { key: "code", title: "№", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "date", title: "Sana", sort: "date", className: "whitespace-nowrap", render: (r) => fmtDate(r.date) },
  { key: "type", title: "Turi", sort: "type", className: "whitespace-nowrap",
    render: (r) => <span className="inline-flex items-center gap-1.5 text-xs">{TYPE_ICON[r.type]}{MOVE_TYPE[r.type]}</span> },
  { key: "product", title: "Mahsulot",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.product.name}</div>
        <div className="text-xs text-muted">{CATEGORY[r.product.category]}{r.product.sku && <> · {r.product.sku}</>}</div>
      </div>
    ) },
  { key: "warehouse", title: "Ombor", className: "whitespace-nowrap text-xs text-muted",
    render: (r) => (r.to_warehouse ? `${r.warehouse.name} → ${r.to_warehouse.name}` : r.warehouse.name) },
  { key: "qty", title: "Miqdor", sort: "qty", align: "right",
    render: (r) => {
      const s = signOf(r);
      return <span className={`whitespace-nowrap font-medium tabular ${s === "+" ? "text-ok" : s === "−" ? "text-bad" : ""}`}>{s}{qty(Math.abs(Number(r.qty)))} <span className="text-xs font-normal text-muted">{r.product.unit}</span></span>;
    } },
  { key: "cost", title: "Tannarx", align: "right", className: "whitespace-nowrap tabular text-muted", render: (r) => (r.unit_cost ? money(r.unit_cost) : "—") },
  { key: "amount", title: "Summa", sort: "amount", align: "right", className: "whitespace-nowrap tabular font-medium",
    render: (r) => (r.status === "draft" ? <span className="text-muted">—</span> : money(Math.abs(Number(r.amount)))) },
  { key: "who", title: "Loyiha / kontragent",
    render: (r) => (
      <div className="min-w-40 text-xs">
        {r.project && <div className="font-mono">{r.project.code}</div>}
        <div className="text-muted">{r.partner?.name ?? (r.project ? r.project.name : "—")}</div>
      </div>
    ) },
  { key: "doc", title: "Hujjat", className: "whitespace-nowrap font-mono text-xs text-muted", render: (r) => r.source_label || r.entry_code || "—" },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={MOVE_STATUS[r.status].tone}>{MOVE_STATUS[r.status].label}</Pill> },
];

const NEW_TYPES: MoveType[] = ["issue", "output", "delivery", "transfer", "adjust"];

/** Ombor: every movement of stock is one row of one table — kirim, chiqim, yetkazish, ko'chirish, tuzatish. */
export function MovesListPage() {
  const can = useCan("inventory");
  const canStock = useCan("stock");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-date" }, ["status", "type"]);
  const sel = useSelection(query);
  const list = movesApi.useList(query);
  const summary = useMovesSummary(query);
  const warehouses = useWarehouses();
  const s = summary.data;
  const f = params.filters;
  const types = (f.type as string[] | undefined) ?? [];
  const statuses = (f.status as string[] | undefined) ?? [];
  const toggle = (key: "type" | "status", list: string[], v: string) =>
    update({ filters: { [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] } });

  return (
    <>
      <PageHeader title="Ombor" lede="Kirim, chiqim, ishlab chiqarish, yetkazish — har bir harakat bitta qator. Qoldiq shu qatorlardan hisoblanadi; o'tkazish jurnalga yozadi."
        action={can.create && (
          <>
            <Button onClick={() => navigate("/inventory/moves/new?type=issue")}><Plus className="size-4" strokeWidth={1.75} /> Chiqim</Button>
            <Menu align="right"
              trigger={() => <Button variant="ghost">Boshqa <ChevronDown className="size-3.5" /></Button>}
              items={NEW_TYPES.filter((t) => t !== "issue").map((t) => ({ label: MOVE_TYPE[t], icon: TYPE_ICON[t], onClick: () => navigate(`/inventory/moves/new?type=${t}`) }))} />
          </>
        )} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Harakatlar" value={s?.count ?? "—"} sub="o'tkazilgan" />
        <Kpi label="Kirim, so'm" value={money(s?.kirim)} tone="text-ok" onClick={() => update({ filters: { type: ["receipt", "output"] } })} />
        <Kpi label="Chiqim, so'm" value={money(s?.chiqim)} tone="text-bad" onClick={() => update({ filters: { type: ["issue"] } })} />
        <Kpi label="Yetkazish, so'm" value={money(s?.yetkazish)} onClick={() => update({ filters: { type: ["delivery"] } })} />
        <Kpi label="Ombordagi qoldiq, so'm" value={money(s?.stock_value)} onClick={canStock.view ? () => navigate("/inventory/stock") : undefined} />
      </div>

      <Toolbar action={<ExcelMenu resource="inventory/moves" query={query} selection={sel} />}>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="№, mahsulot, loyiha, hujjat…" />
        <div className="flex flex-wrap gap-1">
          {(Object.keys(MOVE_TYPE) as MoveType[]).map((t) => (
            <button key={t} type="button" onClick={() => toggle("type", types, t)}
              className={`press rounded-full border px-3 py-1 text-xs font-medium ${types.includes(t) ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
              {MOVE_TYPE[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(Object.keys(MOVE_STATUS) as MoveStatus[]).map((st) => (
            <button key={st} type="button" onClick={() => toggle("status", statuses, st)}
              className={`press rounded-full border px-3 py-1 text-xs font-medium ${statuses.includes(st) ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
              {MOVE_STATUS[st].label}
            </button>
          ))}
        </div>
        <Select className="w-44" value={(f.warehouse as string) || ""} onChange={(e) => update({ filters: { warehouse: e.target.value || null } })}>
          <option value="">Barcha omborlar</option>
          {(warehouses.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>
        <Select className="w-44" value={(f.category as string) || ""} onChange={(e) => update({ filters: { category: e.target.value || null } })}>
          <option value="">Barcha turkumlar</option>
          {Object.entries(CATEGORY).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <EntitySelect endpoint="inventory/products" placeholder="Mahsulot" className="w-48"
          value={f.product ? Number(f.product) : null} onChange={(id) => update({ filters: { product: id ? String(id) : null } })} />
        <EntitySelect endpoint="projects" placeholder="Loyiha" className="w-48"
          value={f.project ? Number(f.project) : null} onChange={(id) => update({ filters: { project: id ? String(id) : null } })} />
        <Input type="date" className="w-40" value={(f.date_from as string) || ""} onChange={(e) => update({ filters: { date_from: e.target.value || null } })} />
        <Input type="date" className="w-40" value={(f.date_to as string) || ""} onChange={(e) => update({ filters: { date_to: e.target.value || null } })} />
      </Toolbar>
      <BulkBar resource="inventory/moves" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="inventory-moves" onRowClick={(r) => navigate(`/inventory/moves/${r.id}`)}
        empty="Harakat yo'q. Kirim ta'minotdagi KR o'tkazilganda o'zi paydo bo'ladi." />
    </>
  );
}
