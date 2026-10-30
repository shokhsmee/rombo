import { BookCheck, Boxes, Building2, FileText, ShoppingCart, Wallet } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, Dialog, Input, Select, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDateTime, fmtMoney, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { useWarehouses } from "@/modules/inventory/api";

import { receiptsApi, useReceiptActions, type GoodsReceipt } from "./api";
import { RECEIPT_PIPELINE, RECEIPT_STATUS } from "./statuses";

type Values = { date: string; warehouse_id: number | null; invoice_number: string; invoice_date: string; invoice_total: string; notes: string; qty: Record<number, string> };

/** A receipt is always made from an order ("Kirim qilish"); this page edits the quantities and the ESF block. */
export function ReceiptFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useCan("goods_receipts");
  const canMoves = useCan("inventory");
  const warehouses = useWarehouses();
  const detail = receiptsApi.useDetail(id);
  const save = receiptsApi.useSave();
  const remove = receiptsApi.useRemove();
  const r = detail.data;
  const draft = r?.status === "draft";
  const editable = can.update && !!r && r.status !== "cancelled";

  const form = useServerForm<Values, GoodsReceipt>({
    initial: { date: "", warehouse_id: null, invoice_number: "", invoice_date: "", invoice_total: "", notes: "", qty: {} },
    record: r,
    toForm: (x) => ({
      date: x.date, warehouse_id: x.warehouse_id, invoice_number: x.invoice_number, invoice_date: x.invoice_date ?? "",
      invoice_total: x.invoice_total ? String(Number(x.invoice_total)) : "", notes: x.notes,
      qty: Object.fromEntries(x.lines.map((l) => [l.order_line_id, String(Number(l.qty))])),
    }),
    validate: {
      qty: (q, all) => {
        for (const ln of r?.lines ?? []) {
          const v = toNum(q[ln.order_line_id] ?? "");
          if (!(v > 0)) return "Miqdor 0 dan katta bo'lishi kerak";
          const left = Number(ln.ordered_qty) - Number(ln.order_received_qty);
          if (v > left + 1e-9) return `${ln.name}: buyurtmada ${left} ${ln.unit} qolgan`;
        }
        return all.date ? null : "Sanani kiriting";
      },
    },
  });
  const v = form.values;
  const a = useReceiptActions();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [comment, setComment] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!r || !form.check()) return;
    const data = {
      invoice_number: v.invoice_number, invoice_date: v.invoice_date || null,
      invoice_total: v.invoice_total ? String(toNum(v.invoice_total)) : null, notes: v.notes,
      ...(draft ? { date: v.date, warehouse_id: v.warehouse_id, lines: r.lines.map((l) => ({ order_line_id: l.order_line_id, qty: String(toNum(v.qty[l.order_line_id])) })) } : {}),
    };
    save.mutate({ id, data }, {
      onSuccess: () => { notifyOk("Saqlandi"); form.commit(); },
      onError: (err) => applyServerErrors(form, err, { lines: "qty" }),
    });
  };

  if (!r) return null;
  const gross = r.lines.reduce((s, l) => s + (toNum(v.qty[l.order_line_id]) || 0) * Number(l.price) * (1 + Number(l.vat_rate) / 100), 0);
  const rate = r.currency === "UZS" ? 1 : Number(r.rate ?? 0);

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={{ model: "procurement.goodsreceipt", id: r.id }}>
        <RecordNav listTo="/procurement/receipts" listLabel="Kirim" crumb={r.code} navKey="procurement/receipts" id={r.id} />

        <ActionBar right={<StatusTrack steps={RECEIPT_PIPELINE.map((s) => [s, RECEIPT_STATUS[s].label])} current={r.status}
          off={r.status === "cancelled" ? RECEIPT_STATUS.cancelled.label : undefined} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} onReset={form.reset} />}
          {!form.dirty && can.update && draft && (
            <Button busy={a.post.isPending}
              onClick={() => a.post.mutate({ id: r.id, body: undefined }, { onSuccess: () => notifyOk("Jurnalga o'tkazildi"), onError: notifyError })}>
              <BookCheck className="size-4" /> O'tkazish
            </Button>
          )}
          {!form.dirty && can.update && r.status === "posted" && (
            <Button variant="ghost" className="text-bad" onClick={() => setCancelOpen(true)}>Bekor qilish (storno)</Button>
          )}
          {draft && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              onConfirm={() => remove.mutate(r.id, { onSuccess: () => navigate("/procurement/receipts"), onError: notifyError })} />
          )}
        </ActionBar>

        <Sheet>
          <SheetTitle eyebrow={`Kirim № ${r.code}`} title={r.supplier.name}
            smart={<>
              <Smart icon={<ShoppingCart className="size-4" />} value={r.order.code} label="Buyurtma" onClick={() => navigate(`/procurement/orders/${r.order_id}`)} />
              <Smart icon={<Building2 className="size-4" />} value={r.supplier.name} label="Yetkazib beruvchi" onClick={() => navigate(`/procurement/suppliers/${r.supplier.id}`)} />
              {r.project && <Smart icon={<FileText className="size-4" />} value={r.project.code} label="Loyiha" onClick={() => navigate(`/projects/${r.project!.id}`)} />}
              {r.stock_moves > 0 && canMoves.view && (
                <Smart icon={<Boxes className="size-4" />} value={r.stock_moves} label={`Ombor · ${r.warehouse?.name ?? ""}`}
                  onClick={() => navigate(`/inventory/moves?source_model=procurement.goodsreceipt&source_id=${r.id}`)} />
              )}
              <Smart icon={<Wallet className="size-4" />} value={fmtMoney(gross, r.currency)} label={r.currency === "UZS" ? "Jami" : `= ${fmtMoney(gross * rate, "UZS")}`} />
            </>} />

          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Sana" required><Input type="date" disabled={!draft} {...form.text("date")} /></Row>
              <Row label="Omborchi"><Input disabled value={r.storekeeper?.full_name ?? "—"} /></Row>
              <Row label="Ombor">
                {draft ? (
                  <>
                    <Select value={v.warehouse_id ?? ""} onChange={(e) => form.set("warehouse_id", e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Asosiy ombor (standart)</option>
                      {(warehouses.data ?? []).filter((w) => w.is_active || w.id === v.warehouse_id).map((w) => <option key={w.id} value={w.id}>{w.name}{w.is_default ? " · asosiy" : ""}</option>)}
                    </Select>
                    <span className="text-xs text-muted">O'tkazilganda har qator omborga kirim bo'ladi</span>
                  </>
                ) : <Input disabled value={r.warehouse?.name ?? "—"} />}
              </Row>
              <Row label="Valyuta / kurs"><Input disabled value={r.currency === "UZS" ? "so'm" : `${r.currency} · kurs ${r.rate ? Number(r.rate).toLocaleString("ru-RU") : "—"}`} /></Row>
              <Row label="Jurnal"><Input disabled value={r.posted_at ? `${fmtDateTime(r.posted_at)} · ${r.posted_by?.full_name ?? ""}${r.entry_id ? ` · yozuv #${r.entry_id}` : ""}` : "o'tkazilmagan"} /></Row>
            </FieldGrid>

            <FieldGrid title="Yetkazib beruvchi hisob-fakturasi (ESF)">
              <Row label="Hisob-faktura №"><Input {...form.text("invoice_number")} placeholder="ESF raqami" /></Row>
              <Row label="Sanasi"><Input type="date" {...form.text("invoice_date")} /></Row>
              <Row label="Summasi" error={form.errors.invoice_total}>
                <Input inputMode="decimal" className="tabular" {...form.text("invoice_total")} placeholder="ESF dagi jami" />
                {v.invoice_total && Math.abs(toNum(v.invoice_total) - gross) > 0.005 && (
                  <span className="text-xs text-warn">Kirim summasi ({fmtMoney(gross, r.currency)}) bilan farq qiladi — narxlarni buyurtmada to'g'rilang.</span>
                )}
              </Row>
              <Row label="Izoh"><Textarea rows={2} {...form.text("notes")} /></Row>
            </FieldGrid>

            <FieldGrid title="Qatorlar">
              <Row label="Kelgan tovar" wide>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                        <th className="px-3 py-2.5 font-medium">Nomi</th>
                        <th className="w-20 px-3 py-2.5 font-medium">Birlik</th>
                        <th className="w-24 px-3 py-2.5 text-right font-medium">Buyurtma</th>
                        <th className="w-24 px-3 py-2.5 text-right font-medium">Avval keldi</th>
                        <th className="w-28 px-3 py-2.5 text-right font-medium">Keldi</th>
                        <th className="w-28 px-3 py-2.5 text-right font-medium">Narx</th>
                        <th className="w-20 px-3 py-2.5 text-right font-medium">QQS %</th>
                        <th className="w-32 px-3 py-2.5 text-right font-medium">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.lines.map((l) => {
                        const q = toNum(v.qty[l.order_line_id] ?? "") || 0;
                        return (
                          <tr key={l.id} className="border-b border-line last:border-0">
                            <td className="px-3 py-1.5"><div className="font-medium">{l.name}</div>{l.project && <div className="text-2xs text-muted">{l.project.code}</div>}</td>
                            <td className="px-3 py-1.5 text-muted">{l.unit}</td>
                            <td className="px-3 py-1.5 text-right tabular">{Number(l.ordered_qty)}</td>
                            <td className="px-3 py-1.5 text-right tabular text-muted">{Number(l.order_received_qty)}</td>
                            <td className="px-2 py-1.5">
                              <Input inputMode="decimal" className="text-right tabular" disabled={!draft} value={v.qty[l.order_line_id] ?? ""}
                                onChange={(e) => form.set("qty", { ...v.qty, [l.order_line_id]: e.target.value })} />
                            </td>
                            <td className="px-3 py-1.5 text-right tabular">{fmtMoney(l.price)}</td>
                            <td className="px-3 py-1.5 text-right tabular">{Number(l.vat_rate)}</td>
                            <td className="px-3 py-1.5 text-right tabular">{fmtMoney(q * Number(l.price) * (1 + Number(l.vat_rate) / 100))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {form.errors.qty && <p className="text-xs font-medium text-bad">{form.errors.qty}</p>}
              </Row>
            </FieldGrid>
          </fieldset>
        </Sheet>

        <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Kirimni bekor qilish"
          footer={<>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Yopish</Button>
            <Button variant="danger" busy={a.cancel.isPending}
              onClick={() => a.cancel.mutate({ id: r.id, body: { comment } }, {
                onSuccess: () => { setCancelOpen(false); notifyOk("Storno yozildi"); }, onError: notifyError })}>
              Bekor qilish
            </Button>
          </>}>
          <p className="text-sm text-muted">Jurnalga teskari yozuv (storno) o'tkaziladi, buyurtmadagi kelgan miqdor qaytariladi. Kerak bo'lsa yangi kirim oching.</p>
          <Textarea autoFocus rows={3} placeholder="Sabab…" value={comment} onChange={(e) => setComment(e.target.value)} />
        </Dialog>
      </RecordPage>
    </form>
  );
}
