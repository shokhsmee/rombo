import { Plus, X } from "lucide-react";

import { IconButton, Input } from "@/components/ui";
import { fmtArea, toNum } from "@/lib/format";
import { RefSelect } from "@/modules/references/RefSelect";

export type ItemRow = { product_type_id: number | null; area_m2: string; quantity: string };

export const emptyRow = (): ItemRow => ({ product_type_id: null, area_m2: "", quantity: "1" });

export function itemsError(rows: ItemRow[]): string | null {
  for (const r of rows) {
    if (!r.product_type_id) return "Har bir qatorda buyurtma turini tanlang";
    if (!(toNum(r.area_m2) > 0)) return "Kvadratura 0 dan katta bo'lishi kerak";
    if (!(Number.isInteger(toNum(r.quantity)) && toNum(r.quantity) >= 1)) return "Soni butun son, kamida 1";
  }
  return null;
}

/** Order lines: type · area (m²) · count, with totals — the card's "Тип заказа + квадратура". */
export function ItemsEditor({ rows, onChange, disabled, error }: {
  rows: ItemRow[]; onChange: (rows: ItemRow[]) => void; disabled?: boolean; error?: string;
}) {
  const set = (i: number, patch: Partial<ItemRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const area = rows.reduce((s, r) => s + (toNum(r.area_m2) || 0), 0);
  const qty = rows.reduce((s, r) => s + (toNum(r.quantity) || 0), 0);

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-3 py-2.5 font-medium">Buyurtma turi</th>
              <th className="w-36 px-3 py-2.5 text-right font-medium">Kvadratura, m²</th>
              <th className="w-28 px-3 py-2.5 text-right font-medium">Soni</th>
              {!disabled && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-2 py-1.5">
                  <RefSelect kind="product_type" value={r.product_type_id} disabled={disabled} placeholder="Tanlang…"
                    onChange={(id) => set(i, { product_type_id: id })} />
                </td>
                <td className="px-2 py-1.5">
                  <Input inputMode="decimal" className="text-right tabular" value={r.area_m2} disabled={disabled}
                    placeholder="0" onChange={(e) => set(i, { area_m2: e.target.value })} />
                </td>
                <td className="px-2 py-1.5">
                  <Input inputMode="numeric" className="text-right tabular" value={r.quantity} disabled={disabled}
                    onChange={(e) => set(i, { quantity: e.target.value })} />
                </td>
                {!disabled && (
                  <td className="px-1">
                    <IconButton label="Qatorni o'chirish" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                      <X className="size-4" />
                    </IconButton>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-5 text-center text-sm text-muted">Hali qator yo'q</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-ground/60 font-semibold">
              <td className="px-3 py-2.5">
                {!disabled ? (
                  <button type="button" onClick={() => onChange([...rows, emptyRow()])}
                    className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                    <Plus className="size-4" /> Qator qo'shish
                  </button>
                ) : "Jami"}
              </td>
              <td className="px-3 py-2.5 text-right tabular">{fmtArea(area)}</td>
              <td className="px-3 py-2.5 text-right tabular">{qty} dona</td>
              {!disabled && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      {error && <p className="text-xs font-medium text-bad">{error}</p>}
    </div>
  );
}
