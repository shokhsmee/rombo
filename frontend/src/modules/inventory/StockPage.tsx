import { useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { Toolbar } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Empty, Kpi, Select, Spinner, Toggle } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { money } from "@/modules/accounting/labels";

import { useStock, useWarehouses } from "./api";
import { CATEGORY, qty } from "./labels";

/** Qoldiqlar: stock on hand per product × warehouse, summed from the posted moves. */
export function StockPage() {
  const navigate = useNavigate();
  const canMoves = useCan("inventory");
  const { params, update } = useListParams();
  const f = params.filters;
  const showZero = f.zero === "1";
  const stock = useStock({ warehouse: (f.warehouse as string) || undefined, category: (f.category as string) || undefined, q: params.q, nonzero: !showZero });
  const warehouses = useWarehouses();
  const s = stock.data;
  const rows = s?.rows ?? [];
  const open = (productId: number, warehouseId: number) =>
    canMoves.view && navigate(`/inventory/moves?product=${productId}&warehouse=${warehouseId}&status=posted`);

  return (
    <>
      <PageHeader title="Qoldiqlar" lede="Har bir mahsulot har bir omborda: miqdor va qiymat o'tkazilgan harakatlar yig'indisi. Qatorni bossangiz — uning harakatlari." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ombordagi qiymat, so'm" value={money(s?.total_value)} />
        <Kpi label="Mahsulotlar" value={s?.products ?? "—"} sub="qoldig'i bor" />
        <Kpi label="Qatorlar" value={rows.length} sub="mahsulot × ombor" />
      </div>
      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Mahsulot, artikul, kod…" />
        <Select className="w-44" value={(f.warehouse as string) || ""} onChange={(e) => update({ filters: { warehouse: e.target.value || null } })}>
          <option value="">Barcha omborlar</option>
          {(warehouses.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>
        <Select className="w-44" value={(f.category as string) || ""} onChange={(e) => update({ filters: { category: e.target.value || null } })}>
          <option value="">Barcha turkumlar</option>
          {Object.entries(CATEGORY).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <Toggle checked={showZero} onChange={(on) => update({ filters: { zero: on ? "1" : null } })} label="Nol qoldiqlar ham" />
      </Toolbar>
      {stock.isLoading ? <Spinner /> : rows.length === 0 ? <Empty>Omborda hech narsa yo'q.</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5 font-medium">Mahsulot</th>
                <th className="px-4 py-2.5 font-medium">Turkum</th>
                <th className="px-4 py-2.5 font-medium">Ombor</th>
                <th className="px-4 py-2.5 text-right font-medium">Miqdor</th>
                <th className="px-4 py-2.5 text-right font-medium">O'rtacha tannarx</th>
                <th className="px-4 py-2.5 text-right font-medium">Qiymat, so'm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.product.id}-${r.warehouse.id}`} onClick={() => open(r.product.id, r.warehouse.id)}
                  className={`border-b border-line last:border-0 ${canMoves.view ? "cursor-pointer hover:bg-ground/60" : ""}`}>
                  <td className="px-4 py-2.5"><div className="font-medium">{r.product.name}</div><div className="font-mono text-2xs text-muted">{r.product.code}{r.product.sku && ` · ${r.product.sku}`}</div></td>
                  <td className="px-4 py-2.5 text-xs text-muted">{CATEGORY[r.product.category]}</td>
                  <td className="px-4 py-2.5">{r.warehouse.name}</td>
                  <td className={`px-4 py-2.5 text-right font-medium tabular ${Number(r.qty) < 0 ? "text-bad" : ""}`}>{qty(r.qty)} <span className="text-xs font-normal text-muted">{r.product.unit}</span></td>
                  <td className="px-4 py-2.5 text-right tabular text-muted">{money(r.avg_cost)}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular">{money(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
