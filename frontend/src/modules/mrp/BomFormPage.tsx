import { Boxes, Calculator, Copy, Plus, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { ActivePill } from "@/components/Status";
import { IconButton, Input, Select, Smart, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { money } from "@/modules/accounting/labels";
import { productsApi } from "@/modules/inventory/api";
import { CATEGORY, qty as fmtQty } from "@/modules/inventory/labels";

import { bomsApi, useExplode, type Basis, type Bom } from "./api";

type Line = { component: { id: number; code: string | null; name: string; unit?: string } | null; qty: string; basis: Basis; waste_pct: string; note: string };
type Values = { product_id: number | null; name: string; notes: string; is_active: boolean; lines: Line[] };

const empty = (): Line => ({ component: null, qty: "", basis: "dona", waste_pct: "0", note: "" });
const num = (v: string) => toNum(v || "0") || 0;

export function BomFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("bom");
  const detail = bomsApi.useDetail(isNew ? undefined : id);
  const save = bomsApi.useSave();
  const remove = bomsApi.useRemove();
  const b = detail.data;
  const productFromUrl = productsApi.useDetail(isNew && sp.get("product") ? sp.get("product")! : undefined);

  const form = useServerForm<Values, Bom>({
    initial: { product_id: sp.get("product") ? Number(sp.get("product")) : null, name: "", notes: "", is_active: true, lines: [empty()] },
    record: b,
    toForm: (r) => ({
      product_id: r.product_id, name: r.name, notes: r.notes, is_active: r.is_active,
      lines: r.lines.map((l) => ({ component: l.component, qty: String(Number(l.qty)), basis: l.basis, waste_pct: String(Number(l.waste_pct)), note: l.note })),
    }),
    validate: {
      product_id: (v) => (v ? null : "Mahsulotni tanlang"),
      lines: (rows) => {
        const filled = rows.filter((r) => r.component || r.qty);
        if (!filled.length) return "Kamida bitta material";
        for (const r of filled) {
          if (!r.component) return "Har qatorda materialni tanlang";
          if (!(num(r.qty) > 0)) return "Miqdor noldan katta bo'lsin";
        }
        return null;
      },
    },
  });
  const v = form.values;
  const editable = isNew ? can.create : can.update;
  const setLine = (i: number, patch: Partial<Line>) => form.set("lines", v.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const costOf = (i: number) => b?.cost.lines[i];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = {
      product_id: v.product_id, name: v.name, notes: v.notes, is_active: v.is_active,
      lines: v.lines.filter((l) => l.component).map((l) => ({ component_id: l.component!.id, qty: String(num(l.qty)), basis: l.basis,
        waste_pct: String(num(l.waste_pct)), note: l.note })),
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => {
        form.commit();
        if (!isNew && saved.id !== b?.id) {
          notifyOk(`Tasdiqlangan loyihada ishlatilgani uchun yangi versiya ochildi: ${saved.code} v${saved.version}`);
          navigate(`/mrp/boms/${saved.id}`, { replace: true });
        } else {
          notifyOk("Saqlandi");
          if (isNew) navigate(`/mrp/boms/${saved.id}`, { replace: true });
        }
      },
      onError: (err) => applyServerErrors(form, err, { product: "product_id" }),
    });
  };

  if (!isNew && !b) return null;
  const title = b ? `${b.code} v${b.version}` : "Yangi tarkib";

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={b ? { model: "mrp.bom", id: b.id } : null}>
        <RecordNav listTo="/mrp/boms" listLabel="Tarkiblar" crumb={title} navKey="mrp-boms" id={b?.id} />
        <ActionBar right={b && <ActivePill active={b.is_active} on="Faol" off="Eski versiya" />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {b && can.delete && !form.dirty && !b.in_use && (
            <DeleteButton busy={remove.isPending} text="Tarkib arxivga o'tkaziladi."
              onConfirm={() => remove.mutate(b.id, { onSuccess: () => navigate("/mrp/boms"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow={b ? `Tarkib · ${title}` : "Tarkib (BOM)"} title={b?.product.name ?? productFromUrl.data?.name ?? title}
            smart={b && (
              <>
                <Smart icon={<Boxes className="size-4" />} value={b.product.code ?? "—"} label="Mahsulot" onClick={() => navigate(`/inventory/products/${b.product.id}`)} />
                <Smart icon={<Wallet className="size-4" />} value={money(b.cost.per_piece)} label="Tannarx / dona" />
                <Smart icon={<Wallet className="size-4" />} value={money(b.cost.per_m2)} label="Tannarx / m²" />
                {b.previous_code && <Smart icon={<Copy className="size-4" />} value={b.previous_code} label="Oldingi versiya" />}
              </>
            )} />
          {b?.in_use && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              Bu tarkib tasdiqlangan loyihada ishlatilgan. Qatorlarni o'zgartirsangiz, yangi versiya ochiladi — tasdiqlangan buyurtmalar o'zgarmaydi.
            </p>
          )}
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Mahsulot" required error={form.errors.product_id}>
                <EntitySelect endpoint="inventory/products" current={b?.product ?? productFromUrl.data} disabled={!editable || !isNew}
                  value={v.product_id} onChange={(pid) => form.set("product_id", pid)} extraParams={{ category: "tayyor" }} />
                <span className="text-xs text-muted">Tayyor mahsulot (yarim tayyor uchun — mahsulot kartasidan «Tarkib»)</span>
              </Row>
              <Row label="Nomi"><Input placeholder="Bo'sh — mahsulot nomi" {...form.text("name")} /></Row>
              <Row label="Faol"><Toggle checked={v.is_active} onChange={(on) => form.set("is_active", on)} label={v.is_active ? "Loyihalarda ishlatiladi" : "Eski versiya"} /></Row>
              <Row label="Izoh"><Textarea rows={1} {...form.text("notes")} /></Row>
            </FieldGrid>

            <FieldGrid title="Materiallar">
              <Row label="Qatorlar" wide>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                        <th className="w-8 px-3 py-2.5 font-medium">№</th>
                        <th className="min-w-64 px-3 py-2.5 font-medium">Material</th>
                        <th className="w-28 px-3 py-2.5 text-right font-medium">Miqdor</th>
                        <th className="w-36 px-3 py-2.5 font-medium">Asos</th>
                        <th className="w-24 px-3 py-2.5 text-right font-medium">Chiqindi %</th>
                        <th className="w-32 px-3 py-2.5 text-right font-medium">Tannarx</th>
                        <th className="w-40 px-3 py-2.5 font-medium">Izoh</th>
                        {editable && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {v.lines.map((l, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="px-3 py-1.5 text-xs text-muted">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            <EntitySelect endpoint="inventory/products" current={l.component} value={l.component?.id ?? null} disabled={!editable}
                              describe={(o) => `${String(o.unit ?? "")} · ${CATEGORY[o.category as keyof typeof CATEGORY] ?? ""}`}
                              onChange={(pid, o) => setLine(i, { component: pid && o ? { id: pid, code: o.code ?? null, name: o.name ?? "", unit: String((o as { unit?: string }).unit ?? "") } : null })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              <Input inputMode="decimal" className="text-right tabular" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                              {l.component?.unit && <span className="text-xs text-muted">{l.component.unit}</span>}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={l.basis} onChange={(e) => setLine(i, { basis: e.target.value as Basis })}>
                              <option value="dona">bir donaga</option>
                              <option value="m2">1 m² ga</option>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={l.waste_pct} onChange={(e) => setLine(i, { waste_pct: e.target.value })} /></td>
                          <td className="px-3 py-1.5 text-right tabular text-muted">{!form.dirty && costOf(i) ? money(costOf(i)!.cost) : "—"}</td>
                          <td className="px-2 py-1.5"><Input value={l.note} onChange={(e) => setLine(i, { note: e.target.value })} /></td>
                          {editable && (
                            <td className="px-1"><IconButton label="Qatorni o'chirish" onClick={() => form.set("lines", v.lines.filter((_, j) => j !== i))}><X className="size-4" /></IconButton></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {editable && (
                      <tfoot>
                        <tr className="border-t border-line bg-ground/60">
                          <td colSpan={8} className="px-3 py-2.5">
                            <button type="button" onClick={() => form.set("lines", [...v.lines, empty()])}
                              className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                              <Plus className="size-4" /> Qator qo'shish
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {form.errors.lines && <p className="text-xs font-medium text-bad">{form.errors.lines}</p>}
                <p className="text-xs text-muted">«1 m² ga» — loyiha buyumining umumiy maydoniga ko'paytiriladi; «bir donaga» — buyum soniga. Yarim tayyor materialning o'z tarkibi bo'lsa, u ham ochib hisoblanadi.</p>
              </Row>
            </FieldGrid>
          </fieldset>
          {b && !form.dirty && <TryIt bom={b} />}
        </Sheet>
      </RecordPage>
    </form>
  );
}

/** "Sinab ko'rish": what N pieces covering X m² need — the same explosion the Loyiha uses. */
function TryIt({ bom }: { bom: Bom }) {
  const [count, setCount] = useState("1");
  const [area, setArea] = useState("1");
  const out = useExplode(bom.id, String(num(count)), String(num(area)));
  return (
    <FieldGrid title="Sinab ko'rish">
      <Row label="Buyum" wide>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Calculator className="size-4 text-muted" strokeWidth={1.75} />
          <Input className="w-20 text-right tabular" inputMode="decimal" value={count} onChange={(e) => setCount(e.target.value)} /> dona,
          <Input className="w-24 text-right tabular" inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} /> m² jami
        </div>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {(out.data ?? []).map((r) => (
            <li key={r.product.id} className="flex items-baseline gap-2 border-b border-line pb-1">
              <Link to={`/inventory/products/${r.product.id}`} className="min-w-0 flex-1 truncate hover:underline">{r.product.name}</Link>
              <b className="tabular font-medium">{fmtQty(r.qty)}</b><span className="text-xs text-muted">{r.product.unit}</span>
            </li>
          ))}
        </ul>
      </Row>
    </FieldGrid>
  );
}
