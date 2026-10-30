import dayjs from "dayjs";
import { Check, FileText, HandCoins, ShoppingCart, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, Dialog, Input, Pill, Select, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDate, fmtDateTime, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import type { Currency } from "@/modules/accounting/api";
import { money } from "@/modules/accounting/labels";

import { paymentRequestsApi, usePaymentRequestActions, usePurposes, type PaymentRequest } from "./api";
import { ORDER_STATUS, PAYMENT_REQUEST_STATUS, unit } from "./labels";

type Values = {
  partner_id: number | null; project_id: number | null; amount: string; currency: Currency; rate: string;
  purpose_id: number | null; basis: string; needed_by: string; notes: string;
};

const EMPTY: Values = { partner_id: null, project_id: null, amount: "", currency: "UZS", rate: "", purpose_id: null, basis: "", needed_by: "", notes: "" };
const num = (v: string) => toNum(v || "0") || 0;
const SOURCE_LINK: Record<string, (id: number) => string> = {
  "procurement.purchaseorder": (id) => `/procurement/orders/${id}`,
};

export function PaymentRequestFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("payment_requests");
  const detail = paymentRequestsApi.useDetail(isNew ? undefined : id);
  const save = paymentRequestsApi.useSave();
  const remove = paymentRequestsApi.useRemove();
  const purposes = usePurposes();
  const r = detail.data;
  const editable = (isNew ? can.create : can.update) && (!r || r.status === "draft");
  const purposeOptions = useMemo(() => (purposes.data ?? []).filter((p) => (p.is_active || p.id === r?.purpose_id) && p.direction !== "in"), [purposes.data, r?.purpose_id]);

  const form = useServerForm<Values, PaymentRequest>({
    initial: EMPTY,
    record: r,
    toForm: (x) => ({
      partner_id: x.partner_id, project_id: x.project_id, amount: String(Number(x.amount)), currency: x.currency,
      rate: x.rate ? String(Number(x.rate)) : "", purpose_id: x.purpose_id, basis: x.basis, needed_by: x.needed_by ?? "", notes: x.notes,
    }),
    validate: {
      partner_id: (v) => (v ? null : "Kontragentni tanlang"),
      amount: (v) => (num(v) > 0 ? null : "Summa noldan katta bo'lsin"),
    },
  });
  const v = form.values;
  useEffect(() => {
    // a new request is usually a supplier payment
    if (isNew && !v.purpose_id && purposeOptions.length) {
      form.set("purpose_id", (purposeOptions.find((p) => p.posting === "partner_supplier") ?? purposeOptions[0]).id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, purposeOptions.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = {
      ...v, amount: String(num(v.amount)), rate: v.currency !== "UZS" && v.rate ? String(toNum(v.rate)) : null,
      needed_by: v.needed_by || null,
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => { notifyOk("Saqlandi"); form.commit(); if (isNew) navigate(`/kassa/payment-requests/${saved.id}`, { replace: true }); },
      onError: (err) => applyServerErrors(form, err, { partner: "partner_id" }),
    });
  };

  if (!isNew && !r) return null;
  const off = r && (r.status === "rejected" || r.status === "cancelled") ? PAYMENT_REQUEST_STATUS[r.status].label : undefined;
  const sourceTo = r?.source_id && SOURCE_LINK[r.source_model] ? SOURCE_LINK[r.source_model](r.source_id) : null;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={r ? { model: "kassa.paymentrequest", id: r.id } : null}>
        <RecordNav listTo="/kassa/payment-requests" listLabel="Pul so'rovlari" crumb={r?.code ?? "Yangi"} navKey="payment-requests" id={r?.id} />
        <ActionBar right={r && <StatusTrack off={off} current={r.status}
          steps={[["draft", "Qoralama"], ["submitted", "Kutilmoqda"], ["approved", "Tasdiqlandi"], ["paid", "To'langan"]]} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {r && !form.dirty && <Actions request={r} canUpdate={can.update} />}
          {r?.status === "draft" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              onConfirm={() => remove.mutate(r.id, { onSuccess: () => navigate("/kassa/payment-requests"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow={r ? `Pul so'rovi № ${r.code}` : "Yangi pul so'rovi"} title={r ? r.partner.name : "Yangi pul so'rovi"}
            smart={r && (
              <>
                <Smart icon={<Wallet className="size-4" />} value={`${money(r.amount)} ${unit(r.currency)}`} label="So'ralgan" />
                <Smart icon={<HandCoins className="size-4" />} value={<span className={Number(r.paid) > 0 ? "text-ok" : ""}>{money(r.paid)}</span>} label="To'langan" />
                {sourceTo && <Smart icon={<ShoppingCart className="size-4" />} value={r.source_label || `#${r.source_id}`} label="Manba" onClick={() => navigate(sourceTo)} />}
                {r.project && <Smart icon={<FileText className="size-4" />} value={r.project.code} label="Loyiha" onClick={() => navigate(`/projects/${r.project_id}`)} />}
              </>
            )} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Kontragent" required error={form.errors.partner_id}>
                <EntitySelect endpoint="clients" current={r?.partner} disabled={!editable} value={v.partner_id} error={form.errors.partner_id}
                  onChange={(cid) => form.set("partner_id", cid)} />
              </Row>
              <Row label="Loyiha">
                <EntitySelect endpoint="projects" current={r?.project} disabled={!editable} placeholder="—" value={v.project_id} onChange={(pid) => form.set("project_id", pid)} />
              </Row>
              <Row label="Summa" required error={form.errors.amount}>
                <div className="flex gap-2">
                  <Input inputMode="decimal" className="min-w-0 flex-1 tabular text-lg font-semibold" {...form.text("amount")} />
                  <Select className="w-24" value={v.currency} onChange={(e) => form.set("currency", e.target.value as Currency)}>
                    <option value="UZS">so'm</option>
                    <option value="USD">USD</option>
                  </Select>
                </div>
              </Row>
              {v.currency !== "UZS" && (
                <Row label="Kurs" error={form.errors.rate}><Input inputMode="decimal" className="tabular" placeholder="Bo'sh — kun kursi" {...form.text("rate")} /></Row>
              )}
              <Row label="Maqsad">
                <Select value={v.purpose_id ?? ""} onChange={(e) => form.set("purpose_id", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">—</option>
                  {purposeOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Row>
              <Row label="Kerak sana"><Input type="date" {...form.text("needed_by")} /></Row>
              <Row label="Asos" wide><Input placeholder="Buyurtma №, shartnoma, hisob…" {...form.text("basis")} /></Row>
              <Row label="Izoh" wide><Textarea rows={2} {...form.text("notes")} /></Row>
            </FieldGrid>
            {r && (
              <FieldGrid title="Qaror">
                <Row label="So'radi"><Input disabled value={r.requested_by || "—"} /></Row>
                <Row label="Qaror">
                  <Input disabled value={r.decided_at ? `${r.decided_by} · ${fmtDateTime(r.decided_at)}${r.decision_comment ? ` · ${r.decision_comment}` : ""}` : "—"} />
                </Row>
              </FieldGrid>
            )}
          </fieldset>
          {r && r.cash_orders.length > 0 && (
            <div className="grid gap-2">
              <p className="t-label border-b border-line pb-2">To'lovlar</p>
              <ul className="grid gap-1 text-sm">
                {r.cash_orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-3">
                    <Link to={`/kassa/orders/${o.id}`} className="font-mono text-accent-ink hover:underline">{o.code ?? `Qoralama #${o.id}`}</Link>
                    <span className="text-muted">{fmtDate(o.date)}</span>
                    <span className="tabular">{money(o.amount)} {unit(o.currency)}</span>
                    <Pill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Pill>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Sheet>
      </RecordPage>
    </form>
  );
}

function Actions({ request: r, canUpdate }: { request: PaymentRequest; canUpdate: boolean }) {
  const navigate = useNavigate();
  const canApprove = useCan("payment_approve");
  const canOrders = useCan("cash_orders");
  const a = usePaymentRequestActions(r.id);
  const [dialog, setDialog] = useState<"reject" | "cancel" | null>(null);
  const [comment, setComment] = useState("");
  const close = () => { setDialog(null); setComment(""); };
  const run = (m: typeof a.approve, msg: string, body: { comment?: string } = {}) =>
    m.mutate(body, { onSuccess: () => { close(); notifyOk(msg); }, onError: notifyError });

  const open = Math.max(Number(r.amount) - Number(r.paid), 0);
  const pay = () => {
    const q = new URLSearchParams({
      kind: "out", partner: String(r.partner_id), amount: String(open), currency: r.currency, payment_request: String(r.id),
      basis: r.basis || `Pul so'rovi ${r.code}`,
    });
    if (r.project_id) q.set("project", String(r.project_id));
    if (r.purpose_id) q.set("purpose", String(r.purpose_id));
    if (r.rate) q.set("rate", String(Number(r.rate)));
    navigate(`/kassa/orders/new?${q.toString()}`);
  };

  return (
    <>
      {canUpdate && r.status === "draft" && <Button busy={a.submit.isPending} onClick={() => run(a.submit, "Kassaga yuborildi")}>Kassaga yuborish</Button>}
      {canApprove.update && r.status === "submitted" && (
        <>
          <Button busy={a.approve.isPending} onClick={() => run(a.approve, "Tasdiqlandi")}><Check className="size-4" strokeWidth={1.75} /> Tasdiqlash</Button>
          <Button variant="danger" onClick={() => setDialog("reject")}><X className="size-4" strokeWidth={1.75} /> Rad etish</Button>
        </>
      )}
      {canOrders.create && r.status === "approved" && open > 0 && (
        <Button onClick={pay}><HandCoins className="size-4" strokeWidth={1.75} /> Pul berish</Button>
      )}
      {canUpdate && ["draft", "submitted", "approved"].includes(r.status) && (
        <Button variant="ghost" className="text-bad" onClick={() => setDialog("cancel")}>Bekor qilish</Button>
      )}
      {r.needed_by && r.status === "submitted" && dayjs(r.needed_by).isBefore(dayjs(), "day") && <Pill tone="bad">Muddati o'tgan</Pill>}

      <Dialog open={dialog === "reject"} onClose={close} title="Pul so'rovini rad etish"
        footer={<>
          <Button variant="ghost" onClick={close}>Yopish</Button>
          <Button variant="danger" disabled={!comment.trim()} busy={a.reject.isPending} onClick={() => run(a.reject, "Rad etildi", { comment })}>Rad etish</Button>
        </>}>
        <p className="text-sm text-muted">Sabab so'rovchiga tarixda ko'rinadi.</p>
        <Textarea autoFocus rows={3} placeholder="Sabab…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
      <Dialog open={dialog === "cancel"} onClose={close} title="Pul so'rovini bekor qilish"
        footer={<>
          <Button variant="ghost" onClick={close}>Yopish</Button>
          <Button variant="danger" busy={a.cancel.isPending} onClick={() => run(a.cancel, "Bekor qilindi", { comment })}>Bekor qilish</Button>
        </>}>
        <Textarea autoFocus rows={3} placeholder="Sabab (ixtiyoriy)…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
    </>
  );
}
