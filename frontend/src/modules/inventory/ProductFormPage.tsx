import { Boxes, Layers, Wallet } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { ActivePill } from "@/components/Status";
import { Button, Input, Select, Smart, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { money } from "@/modules/accounting/labels";

import { useActiveBom } from "@/modules/mrp/api";

import { productsApi, type Category, type Product } from "./api";
import { CATEGORY, qty } from "./labels";

type Values = { name: string; sku: string; unit: string; category: Category; default_cost: string; order_multiple: string; is_active: boolean; notes: string };

export function ProductFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("products");
  const canMoves = useCan("inventory");
  const detail = productsApi.useDetail(isNew ? undefined : id);
  const save = productsApi.useSave();
  const remove = productsApi.useRemove();
  const p = detail.data;

  const form = useServerForm<Values, Product>({
    initial: { name: "", sku: "", unit: "dona", category: "material", default_cost: "", order_multiple: "", is_active: true, notes: "" },
    record: p,
    toForm: (r) => ({ name: r.name, sku: r.sku, unit: r.unit, category: r.category, default_cost: Number(r.default_cost) ? String(Number(r.default_cost)) : "", order_multiple: r.order_multiple ? String(Number(r.order_multiple)) : "", is_active: r.is_active, notes: r.notes }),
    validate: {
      name: (v) => (v.trim() ? null : "Nomini yozing"),
      unit: (v) => (v.trim() ? null : "Birlikni yozing"),
      default_cost: (v) => (!v || toNum(v) >= 0 ? null : "Tannarx noto'g'ri"),
    },
  });
  const v = form.values;
  const editable = isNew ? can.create : can.update;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    save.mutate({ id, data: { ...v, default_cost: v.default_cost ? String(toNum(v.default_cost)) : "0", order_multiple: v.order_multiple ? String(toNum(v.order_multiple)) : null } }, {
      onSuccess: (saved) => { notifyOk("Saqlandi"); form.commit(); if (isNew) navigate(`/inventory/products/${saved.id}`, { replace: true }); },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !p) return null;
  const title = p?.code ?? "Yangi mahsulot";

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={p ? { model: "inventory.product", id: p.id } : null}>
        <RecordNav listTo="/inventory/products" listLabel="Mahsulotlar" crumb={title} navKey="inventory-products" id={p?.id} />
        <ActionBar right={p && <ActivePill active={p.is_active} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {p && canMoves.create && !form.dirty && (
            <Button variant="ghost" onClick={() => navigate(`/inventory/moves/new?type=${p.category === "tayyor" ? "delivery" : "issue"}&product=${p.id}`)}>
              {p.category === "tayyor" ? "Yetkazish" : "Chiqim"}
            </Button>
          )}
          {p && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Mahsulot arxivga o'tkaziladi; harakatlari saqlanadi."
              onConfirm={() => remove.mutate(p.id, { onSuccess: () => navigate("/inventory/products"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow={p ? `${CATEGORY[p.category]} · ${p.code}` : "Mahsulot"} title={p?.name ?? title}
            smart={p && (
              <>
                <Smart icon={<Boxes className="size-4" />} value={`${qty(p.qty_on_hand)} ${p.unit}`} label="Qoldiq"
                  onClick={canMoves.view ? () => navigate(`/inventory/moves?product=${p.id}`) : undefined} />
                {(p.category === "tayyor" || p.category === "yarim") && <BomSmart productId={p.id} />}
                <Smart icon={<Wallet className="size-4" />} value={money(p.value_on_hand)} label={p.avg_cost ? `o'rtacha ${money(p.avg_cost)}` : "Qiymat, so'm"} />
              </>
            )} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Nomi" required error={form.errors.name} wide><Input {...form.text("name")} placeholder="Profil Rombo Termo 60 mm" /></Row>
              <Row label="Turkum" required>
                <Select value={v.category} onChange={(e) => form.set("category", e.target.value as Category)}>
                  {(Object.keys(CATEGORY) as Category[]).map((k) => <option key={k} value={k}>{CATEGORY[k]}</option>)}
                </Select>
                <span className="text-xs text-muted">{v.category === "tayyor" ? "Qiymati 2810 da (tayyor mahsulot)" : "Qiymati 1010 da (materiallar)"}</span>
              </Row>
              <Row label="O'lchov birligi" required error={form.errors.unit}><Input {...form.text("unit")} placeholder="m, m2, dona, kg" /></Row>
              <Row label="Artikul"><Input {...form.text("sku")} /></Row>
              <Row label="Xarid karrasi" error={form.errors.order_multiple}>
                <Input inputMode="decimal" className="tabular" placeholder="masalan 6,5 (profil tayog'i)" {...form.text("order_multiple")} />
                <span className="text-xs text-muted">MRP sotib olinadigan miqdorni shunga yaxlitlaydi</span>
              </Row>
              <Row label="Standart tannarx" error={form.errors.default_cost}>
                <Input inputMode="decimal" className="tabular" placeholder="so'm" {...form.text("default_cost")} />
                <span className="text-xs text-muted">Tuzatish (ortiqcha) uchun, o'rtacha tannarx bo'lmasa</span>
              </Row>
              {p?.price_item && <Row label="Narx ro'yxati"><Input disabled value={p.price_item.name} /></Row>}
              <Row label="Faol"><Toggle checked={v.is_active} onChange={(on) => form.set("is_active", on)} label={v.is_active ? "Faol" : "Nofaol"} /></Row>
              <Row label="Izoh" wide><Textarea rows={2} {...form.text("notes")} /></Row>
            </FieldGrid>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}

/** "Tarkib" on a finished / semi-finished product: open its active BOM or start one. */
function BomSmart({ productId }: { productId: number }) {
  const navigate = useNavigate();
  const bom = useActiveBom(productId);
  if (bom.isLoading) return null;
  return bom.data
    ? <Smart icon={<Layers className="size-4" />} value={`${bom.data.code} v${bom.data.version}`} label={`Tarkib · ${bom.data.lines_count} qator`} onClick={() => navigate(`/mrp/boms/${bom.data!.id}`)} />
    : <Smart icon={<Layers className="size-4" />} value="Yo'q" label="Tarkib yaratish" onClick={() => navigate(`/mrp/boms/new?product=${productId}`)} />;
}
