import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { ActivePill } from "@/components/Status";
import { Checkbox, IconButton, Input, Select, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { RefSelect } from "@/modules/references/RefSelect";

import { pricingApi, type PriceItem, type PriceList } from "./api";

type ItemRow = PriceItem;
type Values = {
  name: string; product_type_id: number | null; bar_length_m: string; currency: "UZS" | "USD";
  is_active: boolean; notes: string; items: ItemRow[];
};

const EMPTY: Values = { name: "", product_type_id: null, bar_length_m: "6.5", currency: "USD", is_active: true, notes: "", items: [] };
const UNITS = ["шт", "компл", "м", "м2", "кг"];

export function PriceListFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("pricing");
  const detail = pricingApi.useDetail(isNew ? undefined : id);
  const save = pricingApi.useSave();
  const remove = pricingApi.useRemove();
  const pl = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, PriceList>({
    initial: EMPTY,
    record: pl,
    toForm: (r) => ({
      name: r.name, product_type_id: r.product_type_id, bar_length_m: r.bar_length_m ? String(Number(r.bar_length_m)) : "",
      currency: r.currency, is_active: r.is_active, notes: r.notes,
      items: r.items.map((i) => ({ ...i, price: String(Number(i.price)) })),
    }),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      items: (rows) => rows.find((r) => !r.name.trim() || !r.unit.trim() || !(toNum(r.price) >= 0))
        ? "Har bir qatorda nom, birlik va narx bo'lsin" : null,
    },
  });
  const v = form.values;
  const setRow = (i: number, patch: Partial<ItemRow>) => form.set("items", v.items.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const rows = [...v.items];
    [rows[i], rows[i + d]] = [rows[i + d], rows[i]];
    form.set("items", rows);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = { ...v, bar_length_m: v.bar_length_m ? String(toNum(v.bar_length_m)) : null,
      items: v.items.map((r) => ({ ...r, price: String(toNum(r.price)) })) };
    save.mutate({ id, data }, {
      onSuccess: (saved) => { notifyOk("Saqlandi"); form.commit(); if (isNew) navigate(`/settings/pricing/${saved.id}`, { replace: true }); },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !pl) return null;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={pl ? { model: "pricing.pricelist", id: pl.id } : null}>
        <RecordNav listTo="/settings/pricing" listLabel="Narxlar" crumb={pl?.name ?? "Yangi"} navKey="pricing" id={pl?.id} />
        <ActionBar right={pl && <ActivePill active={pl.is_active} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {pl && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Narx ro'yxati o'chiriladi. Mavjud hisob-kitoblar o'z narxlarini saqlab qoladi."
              onConfirm={() => remove.mutate(pl.id, { onSuccess: () => navigate("/settings/pricing"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow="Narx ro'yxati" title={isNew ? "Yangi narx ro'yxati" : pl!.name} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Nomi" required error={form.errors.name}><Input placeholder="Rombo Termo 306J 65 seriya" {...form.text("name")} /></Row>
              <Row label="Buyurtma turi"><RefSelect kind="product_type" value={v.product_type_id} onChange={(x) => form.set("product_type_id", x)} /></Row>
              <Row label="Profil uzunligi, m"><Input inputMode="decimal" {...form.text("bar_length_m")} /></Row>
              <Row label="Valyuta">
                <Select value={v.currency} onChange={(e) => form.set("currency", e.target.value as "UZS" | "USD")}>
                  <option value="USD">USD</option>
                  <option value="UZS">so'm</option>
                </Select>
              </Row>
              <Row label="Izoh"><Textarea rows={1} {...form.text("notes")} /></Row>
              <Row label="Holat"><div className="pt-2"><Toggle label="Faol" checked={v.is_active} onChange={(x) => form.set("is_active", x)} /></div></Row>
            </FieldGrid>

            <div className="grid gap-2">
              <p className="t-label border-b border-line pb-2">Komplektlovchilar</p>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                      <th className="w-10 px-3 py-2.5 font-medium">№</th>
                      <th className="px-3 py-2.5 font-medium">Nomi</th>
                      <th className="w-28 px-3 py-2.5 font-medium">Birlik</th>
                      <th className="w-32 px-3 py-2.5 text-right font-medium">Narx, {v.currency}</th>
                      <th className="w-16 px-3 py-2.5 text-center font-medium">Faol</th>
                      {editable && <th className="w-28" />}
                    </tr>
                  </thead>
                  <tbody>
                    {v.items.map((r, i) => (
                      <tr key={r.id ?? `new-${i}`} className={`border-b border-line last:border-0 ${r.is_active ? "" : "opacity-55"}`}>
                        <td className="px-3 text-xs tabular text-muted">{i + 1}</td>
                        <td className="px-2 py-1.5"><Input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} /></td>
                        <td className="px-2 py-1.5">
                          <Input list="units" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} /></td>
                        <td className="px-2 text-center"><Checkbox label="Faol" checked={r.is_active} onChange={editable ? (x) => setRow(i, { is_active: x }) : undefined} /></td>
                        {editable && (
                          <td className="px-1">
                            <div className="flex">
                              <IconButton label="Yuqoriga" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></IconButton>
                              <IconButton label="Pastga" disabled={i === v.items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></IconButton>
                              <IconButton label="O'chirish" className="hover:text-bad" onClick={() => form.set("items", v.items.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editable && (
                  <div className="border-t border-line bg-ground/60 px-3 py-2.5">
                    <button type="button" onClick={() => form.set("items", [...v.items, { name: "", unit: "шт", price: "0", is_active: true }])}
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                      <Plus className="size-4" /> Qator qo'shish
                    </button>
                  </div>
                )}
              </div>
              <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
              {form.errors.items && <p className="text-xs font-medium text-bad">{form.errors.items}</p>}
              <p className="text-xs text-muted">Narxni o'zgartirish eski hisob-kitoblarga ta'sir qilmaydi — ular berilgan kundagi narxda qoladi.</p>
            </div>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}
