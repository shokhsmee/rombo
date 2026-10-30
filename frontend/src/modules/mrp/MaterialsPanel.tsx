import { ClipboardList, ListChecks, PackageMinus, RefreshCw, Snowflake } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { FieldGrid, Row } from "@/components/Record";
import { Button, ConfirmDialog, Dialog, Select } from "@/components/ui";
import { notifyError, notifyOk } from "@/lib/notify";
import { money } from "@/modules/accounting/labels";
import { useWarehouses } from "@/modules/inventory/api";
import { qty } from "@/modules/inventory/labels";

import { useMaterialActions, useMaterials, type Materials } from "./api";

/** Loyiha → Materiallar (add-project-materials): what each item is, what it needs, and the documents from it. */
export function MaterialsPanel({ projectId, calcs, canEdit }: { projectId: number; calcs: { id: number; title: string }[]; canEdit: boolean }) {
  const navigate = useNavigate();
  const m = useMaterials(projectId);
  const a = useMaterialActions(projectId);
  const canBuy = useCan("procurement").create;
  const canIssue = useCan("inventory").create;
  const [ask, setAsk] = useState<"freeze" | "issue" | "fill" | null>(null);
  const warehouses = useWarehouses(canIssue);
  const [warehouse, setWarehouse] = useState<string>("");
  const [calc, setCalc] = useState<string>("");
  const data = m.data;
  if (!data) return null;
  const err = (e: unknown) => { setAsk(null); notifyError(e); };
  const anyRemaining = data.rows.some((r) => Number(r.remaining) > 0);

  return (
    <FieldGrid title="Materiallar (tarkib bo'yicha)">
      <Row label="Buyumlar" wide>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <tbody>
              {data.items.map((it) => (
                <tr key={it.position} className="border-b border-line last:border-0">
                  <td className="w-8 px-3 py-1.5 text-xs text-muted">{it.position + 1}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{it.product_type} · {it.area_m2} m² × {it.quantity}</td>
                  <td className="w-80 px-2 py-1.5">
                    <EntitySelect endpoint="inventory/products" current={it.product} value={it.product?.id ?? null}
                      disabled={!canEdit || data.frozen} extraParams={{ category: "tayyor" }} placeholder="Qaysi mahsulot?"
                      onChange={(pid) => a.itemProduct.mutate({ position: it.position, product_id: pid }, { onError: notifyError })} />
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {it.product && !it.has_bom && <Link to={`/mrp/boms/new?product=${it.product.id}`} className="text-warn hover:underline">tarkibi yo'q — yaratish</Link>}
                    {it.product && it.has_bom && <span className="text-ok">tarkibi bor</span>}
                  </td>
                </tr>
              ))}
              {!data.items.length && <tr><td className="px-3 py-3 text-sm text-muted">Loyihada buyum yo'q — «Mahsulot» bo'limida qo'shing.</td></tr>}
            </tbody>
          </table>
        </div>
        {data.frozen && <p className="text-xs text-muted"><Snowflake className="mr-1 inline size-3" />Materiallar loyiha tasdiqlanganda qayd etilgan — tarkib keyin o'zgarsa ham bu ro'yxat o'zgarmaydi.</p>}
      </Row>

      <Row label="Materiallar" wide>
        {data.rows.length === 0 ? (
          <p className="pt-2 text-sm text-muted">Buyumlarga tarkibi bor mahsulot tanlang — materiallar shu yerda hisoblanadi.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-medium">Material</th>
                  <th className="px-3 py-2 text-right font-medium">Kerak</th>
                  <th className="px-3 py-2 text-right font-medium">Chiqim qilingan</th>
                  <th className="px-3 py-2 text-right font-medium">Qolgan</th>
                  <th className="px-3 py-2 text-right font-medium">So'ralgan</th>
                  <th className="px-3 py-2 text-right font-medium">Omborda</th>
                  <th className="px-3 py-2 text-right font-medium">Tannarx</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const short = Number(r.remaining) > Number(r.stock) + Number(r.requested);
                  return (
                    <tr key={r.product.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5"><Link to={`/inventory/products/${r.product.id}`} className="font-medium hover:underline">{r.product.name}</Link></td>
                      <td className="px-3 py-1.5 text-right tabular">{qty(r.need)} <span className="text-xs text-muted">{r.product.unit}</span></td>
                      <td className="px-3 py-1.5 text-right tabular text-muted">{qty(r.issued)}</td>
                      <td className="px-3 py-1.5 text-right font-medium tabular">{qty(r.remaining)}</td>
                      <td className="px-3 py-1.5 text-right tabular text-muted">{qty(r.requested)}</td>
                      <td className={`px-3 py-1.5 text-right tabular ${short ? "font-medium text-bad" : "text-ok"}`}>{qty(r.stock)}</td>
                      <td className="px-3 py-1.5 text-right tabular text-muted">{money(r.planned_cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">
          Rejalangan tannarx: <b className="text-ink">{money(data.planned_cost)} so'm</b>
          {data.wip !== null && <> · tugallanmagan ishlab chiqarish (2010): <b className="text-ink">{money(data.wip)} so'm</b></>}
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            {calcs.length > 0 && data.rows.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => { setCalc(String(calcs[0].id)); setAsk("fill"); }}><ListChecks className="size-4" strokeWidth={1.75} /> BOM'dan hisob-kitobga</Button>
            )}
            {canBuy && anyRemaining && (
              <Button size="sm" variant="ghost" busy={a.toRequest.isPending}
                onClick={() => a.toRequest.mutate({}, { onSuccess: (x: Materials) => { notifyOk(`Xarid so'rovi ${x.request?.code}`); navigate(`/procurement/requests/${x.request?.id}`); }, onError: notifyError })}>
                <ClipboardList className="size-4" strokeWidth={1.75} /> Xarid so'rovi
              </Button>
            )}
            {canIssue && anyRemaining && (
              <Button size="sm" variant="ghost" onClick={() => setAsk("issue")}><PackageMinus className="size-4" strokeWidth={1.75} /> Chiqim qoralamalari</Button>
            )}
            {!data.issued_any && data.items.some((it) => it.product) && (
              <Button size="sm" variant="quiet" onClick={() => setAsk("freeze")}><RefreshCw className="size-4" strokeWidth={1.75} /> {data.frozen ? "Qayta hisoblash" : "Qayd etish"}</Button>
            )}
          </div>
        )}
      </Row>

      <ConfirmDialog open={ask === "freeze"} onClose={() => setAsk(null)} title="Materiallarni qayta hisoblash" busy={a.freeze.isPending}
        text="Ro'yxat joriy tarkiblardan qayta hisoblanadi va qayd etiladi. Chiqim boshlangandan keyin bu mumkin emas."
        onConfirm={() => a.freeze.mutate({}, { onSuccess: () => { setAsk(null); notifyOk("Qayd etildi"); }, onError: err })} />
      <Dialog open={ask === "issue"} onClose={() => setAsk(null)} title="Chiqim qoralamalari"
        footer={<>
          <Button variant="ghost" onClick={() => setAsk(null)}>Bekor qilish</Button>
          <Button busy={a.toIssue.isPending} onClick={() => a.toIssue.mutate({ warehouse_id: warehouse ? Number(warehouse) : null }, {
            onSuccess: (x: Materials) => { setAsk(null); notifyOk(`${x.moves?.length ?? 0} ta qoralama`); navigate(`/inventory/moves?project=${projectId}&status=draft`); }, onError: err })}>Yaratish</Button>
        </>}>
        <p className="text-sm text-muted">Qolgan har bir material uchun chiqim qoralamasi yaratiladi. Omborda tekshirib, Ombor ro'yxatida birdaniga «O'tkazish» mumkin.</p>
        <Select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
          <option value="">Asosiy ombor</option>
          {(warehouses.data ?? []).filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>
      </Dialog>
      <Dialog open={ask === "fill"} onClose={() => setAsk(null)} title="Hisob-kitobni tarkibdan to'ldirish"
        footer={<>
          <Button variant="ghost" onClick={() => setAsk(null)}>Bekor qilish</Button>
          <Button busy={a.fillCalc.isPending} onClick={() => a.fillCalc.mutate({ calc_id: Number(calc) }, {
            onSuccess: (x: Materials) => {
              setAsk(null);
              const miss = x.fill?.missing ?? [];
              notifyOk(`${x.fill?.filled ?? 0} qator to'ldirildi${miss.length ? `; narx ro'yxatida yo'q: ${miss.map((p) => p.name).join(", ")}` : ""}`);
            }, onError: err })}>To'ldirish</Button>
        </>}>
        <p className="text-sm text-muted">Narx ro'yxati qatoriga bog'langan materiallarning miqdori hisob-kitobga yoziladi (narxlar o'zgarmaydi). Keyin qo'lda o'zgartirsa bo'ladi.</p>
        <Select value={calc} onChange={(e) => setCalc(e.target.value)}>
          {calcs.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
      </Dialog>
    </FieldGrid>
  );
}
