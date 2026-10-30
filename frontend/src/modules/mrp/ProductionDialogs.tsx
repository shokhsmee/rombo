// One-step production moves from the Loyiha card (simplify-production-moves):
//   1. Materiallarni berish — every remaining material at once, 2. Tayyor mahsulotni qabul qilish,
//   3. Mijozga yetkazish. Each creates and posts the warehouse moves in one click.
import { AlertTriangle, CheckCircle2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EntitySelect } from "@/components/EntitySelect";
import { Button, Checkbox, Dialog, IconButton, Input, Select } from "@/components/ui";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { money } from "@/modules/accounting/labels";
import { useWarehouses } from "@/modules/inventory/api";
import { qty as fmtQty } from "@/modules/inventory/labels";

import { useMaterialActions, useMaterials, type Materials } from "./api";

export type Step = "issue" | "output" | "deliver";

type Line = { key: string; product: { id: number; name: string; unit: string }; info: string; max?: number; qty: string; on: boolean };
type Extra = { product: { id: number; name: string; unit: string } | null; qty: string };

const num = (v: string) => toNum(v || "0") || 0;
const round3 = (v: number) => String(Math.round(v * 1000) / 1000);

const TEXT: Record<Step, { title: string; lede: string; button: string; extra: string; category?: string; detail: string }> = {
  issue: {
    title: "1. Materiallarni ishlab chiqarishga berish",
    lede: "Loyihaning tarkib bo'yicha qolgan materiallari. Belgilanganlari tanlangan ombordan sexga beriladi — bitta tugma bilan, hammasi birdan. Hisobda: Dt 2010 Kt 1010.",
    button: "Berish", extra: "Boshqa material qo'shish", detail: "issue",
  },
  output: {
    title: "2. Tayyor mahsulotni omborga qabul qilish",
    lede: "Sexdan chiqqan tayyor mahsulot omborga kiradi. Tannarxi — shu loyihaga berilgan materiallar summasi (2010), soni bo'yicha bo'linadi. Hisobda: Dt 2810 Kt 2010.",
    button: "Qabul qilish", extra: "Boshqa tayyor mahsulot", category: "tayyor", detail: "output",
  },
  deliver: {
    title: "3. Tayyor mahsulotni mijozga yetkazish",
    lede: "Omborda turgan, shu loyiha uchun qilingan tayyor mahsulot mijozga jo'natiladi. Hisobda: Dt 9110 Kt 2810 (sotilgan tannarx).",
    button: "Yetkazish", extra: "Boshqa tayyor mahsulot", category: "tayyor", detail: "delivery",
  },
};

function linesOf(step: Step, m: Materials): Line[] {
  if (step === "issue") {
    return m.rows.filter((r) => Number(r.remaining) > 0).map((r) => {
      const give = Math.max(0, Math.min(Number(r.remaining), Number(r.stock)));
      return { key: `p${r.product.id}`, product: r.product, max: Number(r.stock), qty: round3(give), on: give > 0,
        info: `qolgan ${fmtQty(r.remaining)} · omborda ${fmtQty(r.stock)}` };
    });
  }
  if (step === "output") {
    return m.finished.map((f) => {
      const left = Math.max(0, f.planned - Number(f.produced));
      return { key: `p${f.product.id}`, product: f.product, qty: round3(left), on: left > 0,
        info: `buyurtmada ${f.planned} · qabul qilingan ${fmtQty(f.produced)}` };
    });
  }
  return m.finished.filter((f) => Number(f.stock) > 0).map((f) => {
    const left = Math.max(0, Number(f.produced) - Number(f.delivered));
    const give = Math.min(Number(f.stock), left || Number(f.stock));
    return { key: `p${f.product.id}`, product: f.product, max: Number(f.stock), qty: round3(give), on: give > 0,
      info: `qilingan ${fmtQty(f.produced)} · yetkazilgan ${fmtQty(f.delivered)} · omborda ${fmtQty(f.stock)}` };
  });
}

export function ProductionDialog({ step, projectId, clientName, onClose }: { step: Step; projectId: number; clientName?: string; onClose: () => void }) {
  const t = TEXT[step];
  const warehouses = useWarehouses();
  const active = (warehouses.data ?? []).filter((w) => w.is_active);
  const [warehouse, setWarehouse] = useState<number | null>(null);
  useEffect(() => {
    if (warehouse === null && active.length) setWarehouse((active.find((w) => w.is_default) ?? active[0]).id);
  }, [active, warehouse]);
  const m = useMaterials(projectId, warehouse !== null, warehouse);
  const a = useMaterialActions(projectId);
  const run = step === "issue" ? a.issue : step === "output" ? a.output : a.deliver;
  const base = useMemo(() => (m.data ? linesOf(step, m.data) : []), [m.data, step]);
  const [edits, setEdits] = useState<Record<string, Partial<Line>>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [result, setResult] = useState<Materials["result"] | null>(null);
  const lines = base.map((l) => ({ ...l, ...edits[l.key] }));
  const picked = [
    ...lines.filter((l) => l.on && num(l.qty) > 0).map((l) => ({ product_id: l.product.id, qty: String(num(l.qty)) })),
    ...extras.filter((e) => e.product && num(e.qty) > 0).map((e) => ({ product_id: e.product!.id, qty: String(num(e.qty)) })),
  ];
  const over = lines.some((l) => l.on && l.max !== undefined && num(l.qty) > l.max + 1e-9);

  const submit = () => run.mutate({ warehouse_id: warehouse, lines: picked }, {
    onSuccess: (x) => {
      const r = x.result!;
      if (r.failed.length) setResult(r);
      else { notifyOk(`${t.button}: ${r.done.length} ta — ${r.done.map((d) => d.code).join(", ")}`); onClose(); }
    },
    onError: notifyError,
  });

  if (result) {
    return (
      <Dialog open onClose={onClose} title="Natija" width="max-w-xl" footer={<Button onClick={onClose}>Yopish</Button>}>
        {result.done.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 className="size-4" /> Bajarildi: {result.done.map((d) => `${d.product} (${d.code})`).join(", ")}</p>
        )}
        <p className="flex items-center gap-2 text-sm font-medium text-bad"><AlertTriangle className="size-4" /> Bajarilmadi:</p>
        <ul className="grid gap-1 text-sm">
          {result.failed.map((f, i) => <li key={i} className="rounded-lg bg-bad-soft/50 px-3 py-1.5"><b>{f.product}</b> — {f.message}</li>)}
        </ul>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title={t.title} width="max-w-3xl"
      footer={<>
        <Link to={`/inventory/moves/new?type=${t.detail}&project=${projectId}`} className="mr-auto text-xs text-accent-ink hover:underline">Batafsil forma</Link>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button disabled={!picked.length || over} busy={run.isPending} onClick={submit}>{t.button}{picked.length ? ` (${picked.length})` : ""}</Button>
      </>}>
      <p className="text-sm text-muted">{t.lede}{step === "deliver" && clientName && <> Mijoz: <b className="text-ink">{clientName}</b>.</>}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">Ombor</span>
        <Select className="w-56" value={warehouse ?? ""} onChange={(e) => { setWarehouse(Number(e.target.value)); setEdits({}); }}>
          {active.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>
        {step === "output" && m.data?.wip != null && <span className="text-muted">2010 da: <b className="text-ink">{money(m.data.wip)} so'm</b></span>}
      </div>
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <tbody>
            {lines.map((l) => {
              const bad = l.on && l.max !== undefined && num(l.qty) > l.max + 1e-9;
              return (
                <tr key={l.key} className={`border-b border-line last:border-0 ${l.on ? "" : "text-muted"}`}>
                  <td className="w-10 px-3 py-2"><Checkbox label="Tanlash" checked={l.on} onChange={(on) => setEdits({ ...edits, [l.key]: { ...edits[l.key], on } })} /></td>
                  <td className="px-2 py-2"><div className="font-medium text-ink">{l.product.name}</div><div className="text-xs text-muted">{l.info}</div></td>
                  <td className="w-44 px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <Input inputMode="decimal" className={`text-right tabular ${bad ? "border-bad" : ""}`} value={l.qty}
                        onChange={(e) => setEdits({ ...edits, [l.key]: { ...edits[l.key], qty: e.target.value, on: true } })} />
                      <span className="w-10 text-xs text-muted">{l.product.unit}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {extras.map((e, i) => (
              <tr key={`x${i}`} className="border-b border-line last:border-0">
                <td className="w-10 px-3 py-2"><IconButton label="Olib tashlash" onClick={() => setExtras(extras.filter((_, j) => j !== i))}><X className="size-4" /></IconButton></td>
                <td className="px-2 py-2">
                  <EntitySelect endpoint="inventory/products" current={e.product} value={e.product?.id ?? null}
                    extraParams={{ ...(t.category ? { category: t.category } : {}), ...(step !== "output" && warehouse ? { in_stock: "true", warehouse: String(warehouse) } : {}) }}
                    describe={(o) => `${fmtQty(String(o.qty_in_warehouse ?? o.qty_on_hand ?? ""))} ${String(o.unit ?? "")}`}
                    onChange={(id, o) => setExtras(extras.map((x, j) => (j === i ? { ...x, product: id && o ? { id, name: o.name ?? "", unit: String((o as { unit?: string }).unit ?? "") } : null } : x)))} />
                </td>
                <td className="w-44 px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    <Input inputMode="decimal" className="text-right tabular" value={e.qty} onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, qty: ev.target.value } : x)))} />
                    <span className="w-10 text-xs text-muted">{e.product?.unit}</span>
                  </div>
                </td>
              </tr>
            ))}
            {!lines.length && !extras.length && (
              <tr><td className="px-3 py-4 text-sm text-muted">
                {step === "issue" ? "Tarkib bo'yicha beriladigan material yo'q (buyumlarga mahsulot tanlanmagan yoki hammasi berilgan). Kerak bo'lsa pastdan qo'shing."
                  : step === "output" ? "Buyumlarga tayyor mahsulot tanlanmagan. Pastdan qo'shing."
                    : "Omborda bu loyiha uchun tayyor mahsulot yo'q — avval «Tayyor mahsulotni qabul qilish»."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setExtras([...extras, { product: null, qty: "" }])}
        className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
        <Plus className="size-4" /> {t.extra}
      </button>
      {over && <p className="text-xs font-medium text-bad">Omborda yetarli emas — miqdorni kamaytiring yoki boshqa omborni tanlang.</p>}
    </Dialog>
  );
}
