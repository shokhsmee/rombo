import dayjs from "dayjs";
import { Boxes, Check, FileText, PackageCheck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, ConfirmDialog, Dialog, Input, Select, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { money } from "@/modules/accounting/labels";
import { projectsApi } from "@/modules/projects/api";

import { movesApi, productsApi, useMoveActions, useWarehouses, type MoveType, type StockMove } from "./api";
import { CATEGORY, MOVE_HINT, MOVE_STATUS, MOVE_TYPE, qty as fmtQty } from "./labels";

type Values = {
  type: MoveType; date: string; product_id: number | null; warehouse_id: number | null; to_warehouse_id: number | null;
  qty: string; unit_cost: string; project_id: number | null; notes: string;
};

const MANUAL: MoveType[] = ["issue", "output", "delivery", "transfer", "adjust"];
const NEEDS_PROJECT: MoveType[] = ["issue", "output", "delivery"];
const num = (v: string) => toNum(v || "0") || 0;
/** Types that take goods out of the chosen warehouse: their picker lists only what it holds. */
const FROM_STOCK: MoveType[] = ["issue", "delivery", "transfer"];

function pickerParams(v: Values): Record<string, string> {
  const out: Record<string, string> = {};
  if (v.type === "output" || v.type === "delivery") out.category = "tayyor";
  if (v.warehouse_id) out.warehouse = String(v.warehouse_id);
  if (FROM_STOCK.includes(v.type)) out.in_stock = "true";
  return out;
}
const idOf = (v: string | null) => (v ? Number(v) : null);

export function MoveFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("inventory");
  const detail = movesApi.useDetail(isNew ? undefined : id);
  const save = movesApi.useSave();
  const remove = movesApi.useRemove();
  const warehouses = useWarehouses();
  const m = detail.data;
  const typeFromUrl = sp.get("type") as MoveType | null;

  const form = useServerForm<Values, StockMove>({
    initial: {
      type: typeFromUrl && MANUAL.includes(typeFromUrl) ? typeFromUrl : "issue", date: dayjs().format("YYYY-MM-DD"),
      product_id: idOf(sp.get("product")), warehouse_id: idOf(sp.get("warehouse")), to_warehouse_id: null, qty: "",
      unit_cost: "", project_id: idOf(sp.get("project")), notes: "",
    },
    record: m,
    toForm: (r) => ({
      type: r.type, date: r.date, product_id: r.product_id, warehouse_id: r.warehouse_id, to_warehouse_id: r.to_warehouse_id,
      qty: String(Number(r.qty)), unit_cost: r.unit_cost && r.status === "draft" ? String(Number(r.unit_cost)) : "",
      project_id: r.project_id, notes: r.notes,
    }),
    validate: {
      product_id: (v) => (v ? null : "Mahsulotni tanlang"),
      qty: (v, all) => (all.type === "adjust" ? (num(v) !== 0 ? null : "Miqdor noldan farq qilsin") : num(v) > 0 ? null : "Miqdor noldan katta bo'lsin"),
      project_id: (v, all) => (!NEEDS_PROJECT.includes(all.type) || v ? null : "Loyihani tanlang"),
      to_warehouse_id: (v, all) => (all.type !== "transfer" ? null : !v ? "Qayerga ko'chirilishini tanlang" : v === all.warehouse_id ? "Boshqa omborni tanlang" : null),
      date: (v) => (v ? null : "Sanani kiriting"),
    },
  });
  const v = form.values;
  const draft = !m || m.status === "draft";
  const editable = (isNew ? can.create : can.update) && draft && m?.type !== "receipt";
  const activeWarehouses = (warehouses.data ?? []).filter((w) => w.is_active || w.id === v.warehouse_id || w.id === v.to_warehouse_id);
  const product = productsApi.useDetail(v.product_id ?? undefined);
  const projectFromUrl = projectsApi.useDetail(isNew && v.project_id ? v.project_id : undefined);
  const p = product.data;

  // a new move lands in the default warehouse
  useEffect(() => {
    if (isNew && !v.warehouse_id && activeWarehouses.length) form.set("warehouse_id", (activeWarehouses.find((w) => w.is_default) ?? activeWarehouses[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, activeWarehouses.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const costTyped = v.type === "output" || (v.type === "adjust" && num(v.qty) > 0);
    const data = {
      ...v, qty: String(num(v.qty)), unit_cost: costTyped && v.unit_cost ? String(num(v.unit_cost)) : null,
      to_warehouse_id: v.type === "transfer" ? v.to_warehouse_id : null,
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => { notifyOk("Saqlandi"); form.commit(); if (isNew) navigate(`/inventory/moves/${saved.id}`, { replace: true }); },
      onError: (err) => applyServerErrors(form, err, { product: "product_id", project: "project_id", to_warehouse: "to_warehouse_id", warehouse: "warehouse_id" }),
    });
  };

  if (!isNew && !m) return null;
  const title = m?.code ?? `Yangi: ${MOVE_TYPE[v.type].toLowerCase()}`;
  const unit = p?.unit ?? m?.product.unit ?? "";
  const outgoing = v.type === "issue" || v.type === "delivery" || v.type === "transfer" || (v.type === "adjust" && num(v.qty) < 0);
  const avg = m?.on_hand?.avg_cost ?? p?.avg_cost ?? null;
  const preview = outgoing && avg ? Math.abs(num(v.qty)) * Number(avg) : v.unit_cost ? Math.abs(num(v.qty)) * num(v.unit_cost) : null;
  const sourceLink = m?.source_model === "procurement.goodsreceipt" && m.source_id ? `/procurement/receipts/${m.source_id}` : null;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={m ? { model: "inventory.stockmove", id: m.id } : null}>
        <RecordNav listTo="/inventory/moves" listLabel="Ombor" crumb={title} navKey="inventory-moves" id={m?.id} />
        <ActionBar right={m && <StatusTrack steps={[["draft", "Qoralama"], ["posted", "O'tkazilgan"]]} current={m.status}
          off={m.status === "cancelled" ? MOVE_STATUS.cancelled.label : undefined} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {m && !form.dirty && <Actions move={m} canUpdate={can.update} />}
          {m?.status === "draft" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Qoralama harakat o'chiriladi."
              onConfirm={() => remove.mutate(m.id, { onSuccess: () => navigate("/inventory/moves"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow={`${MOVE_TYPE[v.type]}${m?.code ? ` · ${m.code}` : ""}`} title={m?.product.name ?? p?.name ?? title}
            smart={m && (
              <>
                {m.status !== "draft" && <Smart icon={<Wallet className="size-4" />} value={`${money(Math.abs(Number(m.amount)))} so'm`} label={m.unit_cost ? `${money(m.unit_cost)} / ${unit}` : "Summa"} />}
                {m.entry_code && <Smart icon={<Check className="size-4" />} value={m.entry_code} label="O'tkazma" onClick={() => navigate(`/accounting/entries/${m.entry_id}`)} />}
                {sourceLink && <Smart icon={<PackageCheck className="size-4" />} value={m.source_label} label="Ta'minot kirimi" onClick={() => navigate(sourceLink)} />}
                {m.project && <Smart icon={<FileText className="size-4" />} value={m.project.code} label="Loyiha" onClick={() => navigate(`/projects/${m.project!.id}`)} />}
                <Smart icon={<Boxes className="size-4" />} value={m.product.code ?? "—"} label="Mahsulot" onClick={() => navigate(`/inventory/products/${m.product.id}`)} />
              </>
            )} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Turi" required>
                <Select value={v.type} disabled={!isNew} onChange={(e) => form.set("type", e.target.value as MoveType)}>
                  {(m?.type === "receipt" ? ["receipt" as MoveType] : MANUAL).map((t) => <option key={t} value={t}>{MOVE_TYPE[t]}</option>)}
                </Select>
                <span className="text-xs text-muted">{MOVE_HINT[v.type]}</span>
              </Row>
              <Row label="Sana" required error={form.errors.date}><Input type="date" {...form.text("date")} /></Row>
              <Row label="Mahsulot" required error={form.errors.product_id}>
                <EntitySelect endpoint="inventory/products" current={m?.product ?? p} disabled={!editable} value={v.product_id}
                  extraParams={pickerParams(v)} placeholder={FROM_STOCK.includes(v.type) ? "Omborda bor mahsulotlar…" : "Tanlang…"}
                  describe={(o) => `${fmtQty(String(o.qty_in_warehouse ?? o.qty_on_hand ?? ""))} ${String(o.unit ?? "")}`}
                  onChange={(pid) => form.set("product_id", pid)} />
                {p && <span className="text-xs text-muted">{CATEGORY[p.category]} · omborlarda {fmtQty(p.qty_on_hand)} {p.unit}{p.avg_cost && <> · o'rtacha {money(p.avg_cost)} so'm</>}</span>}
              </Row>
              <Row label={v.type === "transfer" ? "Qayerdan" : "Ombor"} required error={form.errors.warehouse_id}>
                <Select value={v.warehouse_id ?? ""} onChange={(e) => form.set("warehouse_id", idOf(e.target.value))}>
                  {activeWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
                {m?.on_hand && <span className="text-xs text-muted">Bu omborda: {fmtQty(m.on_hand.qty)} {unit}</span>}
              </Row>
              {v.type === "transfer" && (
                <Row label="Qayerga" required error={form.errors.to_warehouse_id}>
                  <Select value={v.to_warehouse_id ?? ""} onChange={(e) => form.set("to_warehouse_id", idOf(e.target.value))}>
                    <option value="">—</option>
                    {activeWarehouses.filter((w) => w.id !== v.warehouse_id).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </Row>
              )}
              <Row label="Miqdor" required error={form.errors.qty}>
                <div className="flex gap-2">
                  <Input inputMode="decimal" className="tabular text-lg font-semibold" {...form.text("qty")} />
                  {unit && <span className="flex h-9 shrink-0 items-center rounded-lg border border-line bg-ground px-3 text-sm text-muted">{unit}</span>}
                </div>
                {v.type === "adjust" && <span className="text-xs text-muted">Ortiqcha — musbat, kamomad — manfiy (−2)</span>}
                {m?.on_hand && outgoing && Math.abs(num(v.qty)) > Number(m.on_hand.qty) && <span className="text-xs font-medium text-warn">Omborda {fmtQty(m.on_hand.qty)} {unit} bor — o'tkazish rad etiladi.</span>}
              </Row>
              {(v.type === "output" || (v.type === "adjust" && num(v.qty) > 0)) && draft && (
                <Row label="Tannarx" error={form.errors.unit_cost}>
                  <Input inputMode="decimal" className="tabular" placeholder={v.type === "output" ? "Bo'sh — loyihaning 2010 qoldig'i" : "Bo'sh — o'rtacha tannarx"} {...form.text("unit_cost")} />
                </Row>
              )}
              {NEEDS_PROJECT.includes(v.type) && (
                <Row label="Loyiha" required error={form.errors.project_id}>
                  <EntitySelect endpoint="projects" current={m?.project ?? projectFromUrl.data} disabled={!editable} value={v.project_id} onChange={(pid) => form.set("project_id", pid)} />
                  {m?.partner && v.type === "delivery" && <span className="text-xs text-muted">Mijoz: {m.partner.name}</span>}
                </Row>
              )}
              <Row label="Izoh" wide><Textarea rows={2} {...form.text("notes")} /></Row>
            </FieldGrid>
          </fieldset>

          {draft && preview !== null && preview > 0 && (
            <p className="rounded-lg bg-ground/60 px-3 py-2 text-xs text-muted">
              Taxminiy summa: <b className="text-ink">{money(Math.round(preview * 100) / 100)} so'm</b>
              {outgoing && " (o'rtacha tannarx bo'yicha, o'tkazilganda aniqlanadi)"}
            </p>
          )}
          {m && m.status !== "draft" && (
            <p className="text-xs text-muted">
              {m.status === "posted" ? "O'tkazilgan: maydonlar qulflangan." : "Bekor qilingan."}
              {m.entry_id && <> O'tkazma: <Link to={`/accounting/entries/${m.entry_id}`} className="font-mono text-accent-ink hover:underline">{m.entry_code}</Link>.</>}
              {sourceLink && <> Hujjat: <Link to={sourceLink} className="font-mono text-accent-ink hover:underline">{m.source_label}</Link> — uni bekor qilsangiz bu qator ham bekor bo'ladi.</>}
              {m.posted_by && <> · {m.posted_by}</>}
            </p>
          )}
        </Sheet>
      </RecordPage>
    </form>
  );
}

function Actions({ move, canUpdate }: { move: StockMove; canUpdate: boolean }) {
  const { post, cancel } = useMoveActions(move.id);
  const [ask, setAsk] = useState<"post" | "cancel" | null>(null);
  const [comment, setComment] = useState("");
  if (!canUpdate) return null;
  return (
    <>
      {move.status === "draft" && <Button busy={post.isPending} onClick={() => setAsk("post")}><Check className="size-4" strokeWidth={2} /> O'tkazish</Button>}
      {move.status === "posted" && !move.source_model && <Button variant="danger" busy={cancel.isPending} onClick={() => setAsk("cancel")}>Bekor qilish</Button>}
      <ConfirmDialog open={ask === "post"} onClose={() => setAsk(null)} title="Harakatni o'tkazish" confirmLabel="O'tkazish" busy={post.isPending}
        text={`${MOVE_TYPE[move.type]}: ${move.product.name} ${fmtQty(move.qty)} ${move.product.unit}. Qoldiq va jurnal yangilanadi, keyin o'zgartirib bo'lmaydi.`}
        onConfirm={() => post.mutate(undefined, { onSuccess: (m) => { setAsk(null); notifyOk(`O'tkazildi: ${m.code}`); }, onError: (e) => { setAsk(null); notifyError(e); } })} />
      <Dialog open={ask === "cancel"} onClose={() => setAsk(null)} title={`${move.code} ni bekor qilish`}
        footer={<>
          <Button variant="ghost" onClick={() => setAsk(null)}>Yopish</Button>
          <Button variant="danger" disabled={!comment.trim()} busy={cancel.isPending}
            onClick={() => cancel.mutate({ comment }, { onSuccess: () => { setAsk(null); setComment(""); notifyOk("Bekor qilindi"); }, onError: notifyError })}>Bekor qilish</Button>
        </>}>
        <p className="text-sm text-muted">{move.entry_code ? `O'tkazma ${move.entry_code} storno qilinadi, ` : ""}qoldiq qaytadi, harakat «bekor qilingan» bo'ladi. Sabab tarixga yoziladi.</p>
        <Textarea autoFocus rows={3} placeholder="Sabab…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
    </>
  );
}
