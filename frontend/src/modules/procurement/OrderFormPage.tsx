import dayjs from "dayjs";
import { Building2, FileText, Lock, PackageCheck, Plus, Printer, Send, Wallet, X } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, Dialog, IconButton, Input, Segmented, Select, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDateTime, fmtMoney, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { ordersApi, receiptsApi, useOrderActions, type Currency, type OrderLine, type PurchaseOrder, type SentVia } from "./api";
import { ORDER_PIPELINE, ORDER_STATUS, VIA_LABEL } from "./statuses";

type LineRow = { request_line_id: number | null; item_id: number | null; name: string; unit: string; qty: string; price: string; vat_rate: string };
type Values = {
  supplier_id: number | null; project_id: number | null; date: string; expected_date: string; currency: Currency; rate: string;
  notes: string; lines: LineRow[];
};

const today = () => dayjs().format("YYYY-MM-DD");
const EMPTY: Values = { supplier_id: null, project_id: null, date: today(), expected_date: "", currency: "UZS", rate: "", notes: "", lines: [] };
const emptyLine = (): LineRow => ({ request_line_id: null, item_id: null, name: "", unit: "dona", qty: "", price: "", vat_rate: "0" });

const num = (v: string) => toNum(v) || 0;
const lineGross = (l: LineRow) => num(l.qty) * num(l.price) * (1 + num(l.vat_rate) / 100);

export function OrderFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("purchase_orders");
  const canReceipts = useCan("goods_receipts");
  const detail = ordersApi.useDetail(isNew ? undefined : id);
  const save = ordersApi.useSave();
  const remove = ordersApi.useRemove();
  const o = detail.data;
  const draft = !o || o.status === "draft";
  const editable = (isNew ? can.create : can.update) && draft;
  const headerEditable = (isNew ? can.create : can.update) && (!o || o.status !== "cancelled");

  const form = useServerForm<Values, PurchaseOrder>({
    initial: EMPTY,
    record: o,
    toForm: (x) => ({
      supplier_id: x.supplier_id, project_id: x.project_id, date: x.date, expected_date: x.expected_date ?? "",
      currency: x.currency, rate: x.rate ? String(Number(x.rate)) : "", notes: x.notes,
      lines: x.lines.map((l) => ({ request_line_id: l.request_line_id, item_id: l.item_id, name: l.name, unit: l.unit,
        qty: String(Number(l.qty)), price: String(Number(l.price)), vat_rate: String(Number(l.vat_rate)) })),
    }),
    validate: {
      supplier_id: (v) => (v ? null : "Yetkazib beruvchini tanlang"),
      rate: (v, all) => (all.currency === "UZS" || toNum(v) > 0 ? null : "Valyuta kursini kiriting"),
      lines: (rows) => {
        for (const r of rows) {
          if (!r.name.trim()) return "Har bir qatorda nomni yozing";
          if (!(num(r.qty) > 0)) return "Miqdor 0 dan katta bo'lishi kerak";
          if (num(r.price) < 0) return "Narx manfiy bo'lmaydi";
        }
        return null;
      },
    },
  });
  const v = form.values;
  const net = v.lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0);
  const gross = v.lines.reduce((s, l) => s + lineGross(l), 0);
  const rate = v.currency === "UZS" ? 1 : num(v.rate);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = draft ? {
      supplier_id: v.supplier_id, project_id: v.project_id, date: v.date || today(), expected_date: v.expected_date || null,
      currency: v.currency, rate: v.currency === "UZS" ? null : String(toNum(v.rate)), notes: v.notes,
      lines: v.lines.map((l) => ({ request_line_id: l.request_line_id, item_id: l.item_id, name: l.name.trim(), unit: l.unit.trim() || "dona",
        qty: String(num(l.qty)), price: String(num(l.price)), vat_rate: String(num(l.vat_rate)) })),
    } : { expected_date: v.expected_date || null, notes: v.notes };
    save.mutate({ id, data }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/procurement/orders/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !o) return null;
  const balance = o ? Number(o.supplier_balance.balance_uzs) : 0;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={o ? { model: "procurement.purchaseorder", id: o.id } : null}>
        <RecordNav listTo="/procurement/orders" listLabel="Buyurtmalar" crumb={o?.code ?? "Yangi"} navKey="procurement/orders" id={o?.id} />

        <ActionBar right={o && <StatusTrack steps={ORDER_PIPELINE.map((s) => [s, ORDER_STATUS[s].label])} current={o.status}
          off={o.status === "cancelled" ? ORDER_STATUS.cancelled.label : undefined} />}>
          {headerEditable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {o && !form.dirty && <Actions order={o} canUpdate={can.update} canReceive={canReceipts.create} />}
          {o && !form.dirty && (
            <Button variant="ghost" onClick={() => window.open(`/print/procurement/orders/${o.id}`, "_blank")}>
              <Printer className="size-4" strokeWidth={1.75} /> Chop etish
            </Button>
          )}
          {o?.status === "draft" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              onConfirm={() => remove.mutate(o.id, { onSuccess: () => navigate("/procurement/orders"), onError: notifyError })} />
          )}
        </ActionBar>

        {o && !draft && o.status !== "cancelled" && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-sunk/60 px-3 py-2 text-sm text-muted">
            <Lock className="size-4 shrink-0" />
            Yuborilgan buyurtma qatorlari o'zgartirilmaydi — yetkazib beruvchidagi qog'oz bilan bir xil qoladi. Kerak bo'lsa bekor qilib yangisini oching.
          </div>
        )}

        <Sheet>
          <SheetTitle eyebrow={o ? `Buyurtma № ${o.code}` : "Yangi buyurtma"} title={isNew ? "Yangi buyurtma" : o!.supplier.name}
            smart={o && (
              <>
                <Smart icon={<Building2 className="size-4" />} value={o.supplier.name} label="Yetkazib beruvchi" onClick={() => navigate(`/procurement/suppliers/${o.supplier_id}`)} />
                {o.project && <Smart icon={<FileText className="size-4" />} value={o.project.code} label="Loyiha" onClick={() => navigate(`/projects/${o.project_id}`)} />}
                <Smart icon={<Wallet className="size-4" />} value={fmtMoney(o.totals.gross, o.currency)} label={o.currency === "UZS" ? "Jami" : `= ${fmtMoney(o.totals.gross_uzs, "UZS")}`} />
                <Smart icon={<Wallet className={`size-4 ${balance > 0 ? "text-bad" : "text-ok"}`} />}
                  value={<span className={balance > 0 ? "text-bad" : balance < 0 ? "text-ok" : ""}>{fmtMoney(Math.abs(balance), "UZS")}</span>}
                  label={balance > 0 ? "Qarzimiz" : balance < 0 ? "Avans" : "Saldo"} onClick={() => navigate(`/procurement/suppliers/${o.supplier_id}`)} />
                {canReceipts.view && o.receipts.length > 0 && (
                  <Smart icon={<PackageCheck className="size-4" />} value={o.receipts.length} label="Kirim" onClick={() => navigate(`/procurement/receipts?order=${o.id}`)} />
                )}
              </>
            )} />

          <fieldset disabled={!headerEditable} className="grid gap-6">
            <FieldGrid>
              <Row label="Yetkazib beruvchi" required error={form.errors.supplier_id}>
                <EntitySelect endpoint="procurement/suppliers" current={o?.supplier} disabled={!editable} error={form.errors.supplier_id}
                  value={v.supplier_id}
                  onChange={(sid, opt) => {
                    form.set("supplier_id", sid);
                    const cur = (opt as { price_currency?: Currency } | null)?.price_currency;
                    if (cur && isNew) form.set("currency", cur);
                  }} />
              </Row>
              <Row label="Loyiha">
                <EntitySelect endpoint="projects" current={o?.project} disabled={!editable} placeholder="Ixtiyoriy — bir nechta loyiha uchun bo'sh qoldiring"
                  value={v.project_id} onChange={(pid) => form.set("project_id", pid)} />
              </Row>
              <Row label="Sana"><Input type="date" disabled={!editable} {...form.text("date")} /></Row>
              <Row label="Kutilayotgan sana"><Input type="date" {...form.text("expected_date")} /></Row>
              <Row label="Valyuta va kurs" error={form.errors.rate}>
                <div className="flex gap-2">
                  <Select className="w-24" disabled={!editable} value={v.currency} onChange={(e) => form.set("currency", e.target.value as Currency)}>
                    <option value="UZS">so'm</option>
                    <option value="USD">USD</option>
                  </Select>
                  <Input inputMode="decimal" className="tabular" placeholder="1 USD = … so'm" disabled={!editable || v.currency === "UZS"} {...form.text("rate")} />
                </div>
              </Row>
              <Row label="Yuborildi">
                <Input disabled value={o?.sent_at ? `${fmtDateTime(o.sent_at)} · ${o.sent_via ? VIA_LABEL[o.sent_via] : ""}${o.sent_to ? ` → ${o.sent_to}` : ""} · ${o.sent_by?.full_name ?? ""}` : "—"} />
              </Row>
              <Row label="Izoh" wide><Textarea {...form.text("notes")} placeholder="Yetkazib beruvchi ko'radigan izoh" /></Row>
            </FieldGrid>

            <FieldGrid title="Qatorlar">
              <Row label="Materiallar" wide>
                <LinesEditor rows={v.lines} disabled={!editable} error={form.errors.lines} currency={v.currency} saved={o?.lines}
                  onChange={(rows) => form.set("lines", rows)} />
                <div className="mt-1 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted">QQSsiz: <b className="tabular text-ink">{fmtMoney(net, v.currency)}</b></span>
                  <span className="text-muted">QQS: <b className="tabular text-ink">{fmtMoney(gross - net, v.currency)}</b></span>
                  <span className="text-muted">Jami: <b className="tabular text-ink">{fmtMoney(gross, v.currency)}</b></span>
                  {v.currency !== "UZS" && rate > 0 && <span className="text-muted">= <b className="tabular text-ink">{fmtMoney(gross * rate, "UZS")}</b></span>}
                </div>
              </Row>
            </FieldGrid>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}

function LinesEditor({ rows, onChange, disabled, error, currency, saved }: {
  rows: LineRow[]; onChange: (rows: LineRow[]) => void; disabled: boolean; error?: string; currency: Currency; saved?: OrderLine[];
}) {
  const set = (i: number, patch: Partial<LineRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const showReceived = disabled && !!saved;
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="w-8 px-3 py-2.5 font-medium">№</th>
              <th className="px-3 py-2.5 font-medium">Nomi</th>
              <th className="w-20 px-3 py-2.5 font-medium">Birlik</th>
              <th className="w-24 px-3 py-2.5 text-right font-medium">Miqdor</th>
              {showReceived && <th className="w-24 px-3 py-2.5 text-right font-medium">Keldi</th>}
              <th className="w-28 px-3 py-2.5 text-right font-medium">Narx, {currency}</th>
              <th className="w-20 px-3 py-2.5 text-right font-medium">QQS %</th>
              <th className="w-32 px-3 py-2.5 text-right font-medium">Summa</th>
              {!disabled && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 text-xs text-muted">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <Input value={l.name} disabled={disabled} placeholder="Material" className="min-w-44" onChange={(e) => set(i, { name: e.target.value })} />
                  {saved?.[i]?.request_code && <span className="text-2xs text-muted">{saved[i].request_code}{saved[i].project ? ` · ${saved[i].project!.code}` : ""}</span>}
                </td>
                <td className="px-2 py-1.5"><Input value={l.unit} disabled={disabled} onChange={(e) => set(i, { unit: e.target.value })} /></td>
                <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={l.qty} disabled={disabled} onChange={(e) => set(i, { qty: e.target.value })} /></td>
                {showReceived && (
                  <td className="px-3 py-1.5 text-right tabular">
                    {saved![i] ? <span className={Number(saved![i].received_qty) >= Number(saved![i].qty) ? "text-ok" : Number(saved![i].received_qty) > 0 ? "text-warn" : "text-muted"}>{Number(saved![i].received_qty)}</span> : "—"}
                  </td>
                )}
                <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={l.price} disabled={disabled} placeholder="0" onChange={(e) => set(i, { price: e.target.value })} /></td>
                <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={l.vat_rate} disabled={disabled} onChange={(e) => set(i, { vat_rate: e.target.value })} /></td>
                <td className="px-3 py-1.5 text-right tabular">{fmtMoney(lineGross(l))}</td>
                {!disabled && (
                  <td className="px-1">
                    <IconButton label="Qatorni o'chirish" onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-5 text-center text-sm text-muted">Hali qator yo'q</td></tr>}
          </tbody>
          {!disabled && (
            <tfoot>
              <tr className="border-t border-line bg-ground/60">
                <td colSpan={9} className="px-3 py-2.5">
                  <button type="button" onClick={() => onChange([...rows, emptyLine()])} className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                    <Plus className="size-4" /> Qator qo'shish
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {error && <p className="text-xs font-medium text-bad">{error}</p>}
    </div>
  );
}

function Actions({ order: o, canUpdate, canReceive }: { order: PurchaseOrder; canUpdate: boolean; canReceive: boolean }) {
  const navigate = useNavigate();
  const a = useOrderActions();
  const createReceipt = receiptsApi.useSave();
  const [dialog, setDialog] = useState<"send" | "cancel" | null>(null);
  const [via, setVia] = useState<SentVia>("print");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const close = () => { setDialog(null); setNote(""); setComment(""); };
  // the email address is only a default for `via = email`; print / other take free text ("kuryer", "Telegram")
  const pickVia = (x: SentVia) => { setVia(x); setTo(x === "email" ? o.supplier_email : ""); };

  const canSend = canUpdate && (o.status === "draft" || o.status === "sent") && o.lines.length > 0;
  const canReceipt = canReceive && (o.status === "sent" || o.status === "partially_received");

  const send = () => a.send.mutate({ id: o.id, body: { via, to, note } }, {
    onSuccess: () => {
      close();
      notifyOk(via === "email" ? `Email yuborildi: ${to || o.supplier_email}` : "Yuborildi deb belgilandi");
      if (via === "print") window.open(`/print/procurement/orders/${o.id}`, "_blank");
    },
    onError: notifyError,
  });

  const receipt = () => createReceipt.mutate({ data: { order_id: o.id } }, {
    onSuccess: (r) => { notifyOk(`Kirim ${r.code}`); navigate(`/procurement/receipts/${r.id}`); },
    onError: notifyError,
  });

  return (
    <>
      {canSend && (
        <Button onClick={() => { pickVia("print"); setDialog("send"); }}>
          <Send className="size-4" /> {o.status === "draft" ? "Yuborish" : "Qayta yuborish"}
        </Button>
      )}
      {canReceipt && <Button variant={canSend ? "soft" : "primary"} busy={createReceipt.isPending} onClick={receipt}><PackageCheck className="size-4" /> Kirim qilish</Button>}
      {canUpdate && o.allowed_statuses.includes("cancelled") && (
        <Button variant="ghost" className="text-bad" onClick={() => setDialog("cancel")}>Bekor qilish</Button>
      )}

      <Dialog open={dialog === "send"} onClose={close} title={`Buyurtma ${o.code} — yetkazib beruvchiga yuborish`}
        footer={<>
          <Button variant="ghost" onClick={close}>Yopish</Button>
          <Button busy={a.send.isPending} disabled={via === "email" && !to.trim()} onClick={send}>
            {via === "email" ? "Email yuborish" : "Yuborildi deb belgilash"}
          </Button>
        </>}>
        <p className="text-sm text-muted">Kim, qachon va qanday yuborgani tarixga yoziladi. Yuborilgandan keyin qatorlar qulflanadi.</p>
        <Segmented value={via} onChange={pickVia} options={[{ value: "print", label: "Chop etib" }, { value: "email", label: "Email" }, { value: "other", label: "Boshqa" }]} />
        {via === "email" ? (
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Kimga</span>
            <Input type="email" value={to} placeholder="sales@akfa.uz" onChange={(e) => setTo(e.target.value)} />
            {!o.supplier_email && <span className="text-xs text-muted">Yetkazib beruvchi kartochkasida email yo'q — qo'lda kiriting.</span>}
          </label>
        ) : (
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Kimga / qanday</span>
            <Input value={to} placeholder={via === "print" ? "Kuryer, ofisga olib borildi…" : "Telegram, telefon…"} onChange={(e) => setTo(e.target.value)} />
          </label>
        )}
        <Textarea rows={2} placeholder="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} />
      </Dialog>

      <Dialog open={dialog === "cancel"} onClose={close} title="Buyurtmani bekor qilish"
        footer={<>
          <Button variant="ghost" onClick={close}>Yopish</Button>
          <Button variant="danger" busy={a.cancel.isPending}
            onClick={() => a.cancel.mutate({ id: o.id, body: { comment } }, { onSuccess: () => { close(); notifyOk("Bekor qilindi"); }, onError: notifyError })}>
            Bekor qilish
          </Button>
        </>}>
        <p className="text-sm text-muted">So'rov qatorlari yana buyurtma uchun ochiladi. Kirim o'tkazilgan buyurtma bekor qilinmaydi.</p>
        <Textarea autoFocus rows={3} placeholder="Sabab…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
    </>
  );
}
