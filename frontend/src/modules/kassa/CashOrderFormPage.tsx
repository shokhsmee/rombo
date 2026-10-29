import dayjs from "dayjs";
import { BookOpen, Check, Printer, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, ConfirmDialog, Dialog, Input, Select, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { useInvoicesOf, usePartnerBalance, useRoles } from "@/modules/accounting/api";
import { money } from "@/modules/accounting/labels";
import { clientsApi } from "@/modules/clients/api";
import { projectsApi } from "@/modules/projects/api";

import { ordersApi, useCashAccounts, useOrderActions, usePurposes, type CashOrder, type OrderKind, type Purpose } from "./api";
import { formName, ORDER_KIND, ORDER_STATUS, unit } from "./labels";

type Values = {
  kind: OrderKind; date: string; account_id: number | null; to_account_id: number | null; amount: string; rate: string;
  purpose_id: number | null; account_role: string; partner_id: number | null; project_id: number | null;
  employee_id: number | null; invoice_id: number | null; basis: string; received_from: string; issued_to: string; notes: string;
};

const EXPENSE_ROLES = ["admin_expense", "selling_expense", "other_op_expense"];
const num = (v: string) => toNum(v || "0") || 0;

export function CashOrderFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("cash_orders");
  const detail = ordersApi.useDetail(isNew ? undefined : id);
  const save = ordersApi.useSave();
  const remove = ordersApi.useRemove();
  const accounts = useCashAccounts();
  const purposes = usePurposes();
  const roles = useRoles();
  const o = detail.data;
  const kindFromUrl = (sp.get("kind") as OrderKind | null) ?? "in";

  const EMPTY: Values = {
    kind: kindFromUrl, date: dayjs().format("YYYY-MM-DD"), account_id: sp.get("account") ? Number(sp.get("account")) : null,
    to_account_id: null, amount: sp.get("amount") ? String(Number(sp.get("amount"))) : "", rate: "",
    purpose_id: sp.get("purpose") ? Number(sp.get("purpose")) : null, account_role: "",
    partner_id: sp.get("partner") ? Number(sp.get("partner")) : null, project_id: sp.get("project") ? Number(sp.get("project")) : null,
    employee_id: null, invoice_id: null, basis: sp.get("basis") ?? "", received_from: "", issued_to: "", notes: "",
  };
  const form = useServerForm<Values, CashOrder>({
    initial: EMPTY,
    record: o,
    toForm: (r) => ({
      kind: r.kind, date: r.date, account_id: r.account_id, to_account_id: r.to_account_id, amount: String(Number(r.amount)),
      rate: r.rate ? String(Number(r.rate)) : "", purpose_id: r.purpose_id, account_role: r.account_role, partner_id: r.partner_id,
      project_id: r.project_id, employee_id: r.employee_id, invoice_id: r.invoice_id, basis: r.basis, received_from: r.received_from,
      issued_to: r.issued_to, notes: r.notes,
    }),
    validate: {
      account_id: (v) => (v ? null : "Kassani tanlang"),
      to_account_id: (v, all) => (all.kind !== "transfer" || v ? null : "Qayerga o'tkazilishini tanlang"),
      purpose_id: (v, all) => (all.kind === "transfer" || v ? null : "Maqsadni tanlang"),
      amount: (v) => (num(v) > 0 ? null : "Summa noldan katta bo'lsin"),
      date: (v) => (v ? null : "Sanani kiriting"),
      rate: (v) => (!v || toNum(v) > 0 ? null : "Kurs noto'g'ri"),
    },
  });
  const v = form.values;
  const editable = (isNew ? can.create : can.update) && (!o || o.status === "draft");
  const activeAccounts = (accounts.data ?? []).filter((a) => a.is_active || a.id === v.account_id || a.id === v.to_account_id);
  const account = activeAccounts.find((a) => a.id === v.account_id) ?? null;
  const currency = account?.currency ?? o?.currency ?? "UZS";
  // a kirim opened from a Loyiha or client card arrives with ids only: load the names for the pickers
  const partnerFromUrl = clientsApi.useDetail(isNew && v.partner_id ? v.partner_id : undefined);
  const projectFromUrl = projectsApi.useDetail(isNew && v.project_id ? v.project_id : undefined);
  const purposeOptions = useMemo(
    () => (purposes.data ?? []).filter((p) => (p.is_active || p.id === v.purpose_id) && (p.direction === "both" || p.direction === v.kind)),
    [purposes.data, v.kind, v.purpose_id]);
  const purpose: Purpose | null = purposeOptions.find((p) => p.id === v.purpose_id) ?? null;
  const partnerPosting = purpose?.posting === "partner_customer" || purpose?.posting === "partner_supplier";
  const balance = usePartnerBalance(partnerPosting ? v.partner_id : null);
  const invoices = useInvoicesOf(
    { partner: v.partner_id, status: "confirmed", kind: purpose?.posting === "partner_customer" ? "customer" : "supplier", size: 50 },
    partnerPosting && !!v.partner_id);

  // the default account: the first active kassa; the default purpose: the first one of the direction
  useEffect(() => {
    if (isNew && !v.account_id && activeAccounts.length) form.set("account_id", activeAccounts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, activeAccounts.length]);
  useEffect(() => {
    if (isNew && v.kind !== "transfer" && purposeOptions.length && !purposeOptions.some((p) => p.id === v.purpose_id)) {
      // from a Loyiha / client card: the customer purpose; a plain chiqim: the first expense-like purpose
      const wanted = sp.get("partner") || sp.get("project") ? purposeOptions.find((p) => p.posting === "partner_customer")
        : v.kind === "out" ? purposeOptions.find((p) => p.posting === "account") : null;
      form.set("purpose_id", (wanted ?? purposeOptions[0]).id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, v.kind, purposeOptions.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = {
      ...v, amount: String(num(v.amount)), rate: currency !== "UZS" && v.rate ? String(toNum(v.rate)) : null,
      to_account_id: v.kind === "transfer" ? v.to_account_id : null, purpose_id: v.kind === "transfer" ? null : v.purpose_id,
      account_role: purpose?.posting === "account" ? v.account_role : "",
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => { notifyOk("Saqlandi"); form.commit(); if (isNew) navigate(`/kassa/orders/${saved.id}`, { replace: true }); },
      onError: (err) => applyServerErrors(form, err, { partner: "partner_id", employee: "employee_id", to_account: "to_account_id" }),
    });
  };

  if (!isNew && !o) return null;
  const title = o?.code ?? (o ? `Qoralama #${o.id}` : `Yangi ${ORDER_KIND[v.kind].toLowerCase()}`);
  const pb = balance.data;
  const owed = pb ? Number(purpose?.posting === "partner_customer" ? pb.ar : pb.ap) : 0;
  const adv = pb ? Number(purpose?.posting === "partner_customer" ? pb.advance_received : pb.advance_paid) : 0;
  const amount = num(v.amount);
  const split = partnerPosting && pb ? previewSplit(v.kind, purpose!.posting, amount, owed, adv) : null;
  const expenseRoles = EXPENSE_ROLES.map((k) => roles.data?.find((r) => r.key === k)).filter(Boolean) as { key: string; label: string; account: { code: string } }[];

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={o ? { model: "kassa.cashorder", id: o.id } : null}>
        <RecordNav listTo="/kassa/orders" listLabel="Kirim / chiqim" crumb={title} navKey="cash-orders" id={o?.id} />
        <ActionBar right={o && <StatusTrack steps={[["draft", "Qoralama"], ["posted", "O'tkazilgan"]]} current={o.status}
          off={o.status === "cancelled" ? ORDER_STATUS.cancelled.label : undefined} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {o && !form.dirty && <Actions order={o} canUpdate={can.update} />}
          {o?.status === "posted" && o.kind !== "transfer" && (
            <Button variant="ghost" onClick={() => window.open(`/print/kassa/orders/${o.id}`, "_blank")}><Printer className="size-4" strokeWidth={1.75} /> Chop etish</Button>
          )}
          {o?.status === "draft" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Qoralama order o'chiriladi."
              onConfirm={() => remove.mutate(o.id, { onSuccess: () => navigate("/kassa/orders"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow={o ? `${formName(o.account.kind, o.kind)} · ${ORDER_KIND[o.kind]}` : account ? formName(account.kind, v.kind) : ORDER_KIND[v.kind]}
            title={o ? (o.partner?.name ?? o.employee?.name ?? (o.kind === "transfer" ? `${o.account.name} → ${o.to_account?.name}` : o.purpose?.name ?? title)) : title}
            smart={o && (
              <>
                <Smart icon={<Wallet className="size-4" />} value={`${money(o.amount)} ${unit(o.currency)}`} label={o.currency !== "UZS" ? `≈ ${money(o.amount_uzs)} so'm` : ORDER_KIND[o.kind]} />
                {o.entry_code && <Smart icon={<Check className="size-4" />} value={o.entry_code} label="O'tkazma" onClick={() => navigate(`/accounting/entries/${o.entry_id}`)} />}
                {pb && <Smart icon={<BookOpen className="size-4" />} value={<span className={Number(pb.net_uzs) > 0 ? "text-bad" : Number(pb.net_uzs) < 0 ? "text-ok" : ""}>{money(pb.net_uzs)}</span>} label="Kontragent saldosi" />}
              </>
            )} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Turi" required>
                <Select value={v.kind} disabled={!isNew} onChange={(e) => { form.set("kind", e.target.value as OrderKind); form.set("purpose_id", null); }}>
                  <option value="in">Kirim (PKO / bank kirimi)</option>
                  <option value="out">Chiqim (RKO / to'lov topshiriqnomasi)</option>
                  <option value="transfer">O'tkazma (hisoblar orasida)</option>
                </Select>
              </Row>
              <Row label="Sana" required error={form.errors.date}><Input type="date" {...form.text("date")} /></Row>
              <Row label={v.kind === "transfer" ? "Qayerdan" : "Kassa / bank"} required error={form.errors.account_id}>
                <Select value={v.account_id ?? ""} disabled={!isNew && !!o?.code} onChange={(e) => form.set("account_id", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">—</option>
                  {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.balance)} {unit(a.currency)}</option>)}
                </Select>
              </Row>
              {v.kind === "transfer" ? (
                <Row label="Qayerga" required error={form.errors.to_account_id}>
                  <Select value={v.to_account_id ?? ""} onChange={(e) => form.set("to_account_id", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {activeAccounts.filter((a) => a.id !== v.account_id && a.currency === currency).map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.balance)} {unit(a.currency)}</option>)}
                  </Select>
                </Row>
              ) : (
                <Row label="Maqsad" required error={form.errors.purpose_id}>
                  <Select value={v.purpose_id ?? ""} onChange={(e) => form.set("purpose_id", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {purposeOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </Row>
              )}
              <Row label="Summa" required error={form.errors.amount}>
                <div className="flex gap-2">
                  <Input inputMode="decimal" className="tabular text-lg font-semibold" {...form.text("amount")} />
                  <span className="flex h-9 shrink-0 items-center rounded-lg border border-line bg-ground px-3 text-sm text-muted">{unit(currency)}</span>
                </div>
                {account && v.kind !== "in" && amount > Number(account.balance) && <span className="text-xs font-medium text-warn">Kassada {money(account.balance)} {unit(currency)} bor — o'tkazish rad etiladi.</span>}
              </Row>
              {currency !== "UZS" && (
                <Row label="Kurs" error={form.errors.rate}><Input inputMode="decimal" className="tabular" placeholder="Bo'sh — kun kursi" {...form.text("rate")} />
                  {amount > 0 && v.rate && <span className="text-xs text-muted">= {money(Math.round(amount * toNum(v.rate)))} so'm</span>}
                </Row>
              )}
              {purpose?.posting === "account" && purpose.account_role === "admin_expense" && (
                <Row label="Xarajat hisobi">
                  <Select value={v.account_role || "admin_expense"} onChange={(e) => form.set("account_role", e.target.value)}>
                    {expenseRoles.map((r) => <option key={r.key} value={r.key}>{r.account.code} · {r.label}</option>)}
                  </Select>
                </Row>
              )}
            </FieldGrid>

            {v.kind !== "transfer" && (
              <FieldGrid title="Kim bilan">
                {(partnerPosting || purpose?.requires_partner || !purpose) && (
                  <Row label="Kontragent" required={partnerPosting || !!purpose?.requires_partner} error={form.errors.partner_id}>
                    <EntitySelect endpoint="clients" current={o?.partner ?? partnerFromUrl.data} disabled={!editable} value={v.partner_id}
                      onChange={(cid) => { form.set("partner_id", cid); form.set("invoice_id", null); }} />
                    {pb && partnerPosting && (
                      <span className="text-xs text-muted">
                        {purpose!.posting === "partner_customer" ? <>Qarzi: <b className={owed > 0 ? "text-bad" : ""}>{money(pb.ar)}</b> · Avansi: <b className="text-ok">{money(pb.advance_received)}</b></>
                          : <>Qarzimiz: <b className={owed > 0 ? "text-bad" : ""}>{money(pb.ap)}</b> · Oldindan to'langan: <b className="text-ok">{money(pb.advance_paid)}</b></>}
                      </span>
                    )}
                  </Row>
                )}
                <Row label="Loyiha">
                  <EntitySelect endpoint="projects" current={o?.project ?? projectFromUrl.data} disabled={!editable} placeholder="—" value={v.project_id} onChange={(pid) => form.set("project_id", pid)} />
                </Row>
                {(purpose?.requires_employee || purpose?.posting === "account") && (
                  <Row label="Xodim" required={!!purpose?.requires_employee} error={form.errors.employee_id}>
                    <EntitySelect endpoint="employees" current={o?.employee} disabled={!editable} extraParams={{ status: "active" }} placeholder="—" value={v.employee_id} onChange={(eid) => form.set("employee_id", eid)} />
                  </Row>
                )}
                {partnerPosting && v.partner_id && (
                  <Row label="Hisob-faktura" error={form.errors.invoice_id}>
                    <Select value={v.invoice_id ?? ""} onChange={(e) => form.set("invoice_id", e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— butun saldo bo'yicha —</option>
                      {o?.invoice && !invoices.data?.items.some((i) => i.id === o.invoice!.id) && <option value={o.invoice.id}>{o.invoice.code} · {money(o.invoice.gross)}</option>}
                      {(invoices.data?.items ?? []).map((i) => <option key={i.id} value={i.id}>{i.code} · {money(i.gross)} {unit(i.currency)} · {dayjs(i.date).format("DD.MM.YYYY")}</option>)}
                    </Select>
                    <span className="text-xs text-muted">Tanlansa, qarz faqat shu hisob-faktura bo'yicha yopiladi; qolgani avans.</span>
                  </Row>
                )}
              </FieldGrid>
            )}

            <FieldGrid title="Hujjat">
              <Row label="Asos" wide><Input placeholder="Shartnoma № …, hisob-faktura, avans…" {...form.text("basis")} /></Row>
              {v.kind === "in" && <Row label="Kimdan qabul qilindi"><Input placeholder="F.I.O. (bo'sh — kontragent nomi)" {...form.text("received_from")} /></Row>}
              {v.kind === "out" && <Row label="Kimga berildi"><Input placeholder="F.I.O. (bo'sh — kontragent / xodim)" {...form.text("issued_to")} /></Row>}
              <Row label="Izoh" wide><Textarea rows={2} {...form.text("notes")} /></Row>
            </FieldGrid>
          </fieldset>

          {split && amount > 0 && (!o || o.status === "draft") && (
            <p className="rounded-lg bg-ground/60 px-3 py-2 text-xs text-muted">
              O'tkaziladi: {split.map((s, i) => <span key={i}>{i > 0 && " · "}<b className="text-ink">{money(s.amount)}</b> {s.label}</span>)}
            </p>
          )}
          {o?.status === "posted" && o.entry_id && (
            <p className="text-xs text-muted">O'tkazilgan: maydonlar qulflangan. O'tkazma: <Link to={`/accounting/entries/${o.entry_id}`} className="font-mono text-accent-ink hover:underline">{o.entry_code}</Link>{o.posted_by && <> · {o.posted_by}</>}. Xato bo'lsa — «Bekor qilish» storno yozadi, keyin yangi order kiriting.</p>
          )}
        </Sheet>
      </RecordPage>
    </form>
  );
}

/** What the posting will look like, from the partner's current balance: "6 200 000 qarzga · 1 800 000 avans". */
function previewSplit(kind: OrderKind, posting: Purpose["posting"], amount: number, owed: number, adv: number) {
  const first = Math.min(amount, Math.max(owed, 0));
  if (posting === "partner_customer") {
    if (kind === "in") return [{ amount: first, label: "qarzni yopadi (4010)" }, { amount: amount - first, label: "avans (6310)" }].filter((s) => s.amount > 0);
    const a = Math.min(amount, adv);
    return [{ amount: a, label: "avans qaytadi (6310)" }, { amount: amount - a, label: "mijoz qarzi (4010)" }].filter((s) => s.amount > 0);
  }
  if (kind === "out") return [{ amount: first, label: "qarzni yopadi (6010)" }, { amount: amount - first, label: "oldindan to'lov (4310)" }].filter((s) => s.amount > 0);
  const a = Math.min(amount, adv);
  return [{ amount: a, label: "oldindan to'lov qaytadi (4310)" }, { amount: amount - a, label: "qarzimiz (6010)" }].filter((s) => s.amount > 0);
}

function Actions({ order, canUpdate }: { order: CashOrder; canUpdate: boolean }) {
  const { post, cancel } = useOrderActions(order.id);
  const [ask, setAsk] = useState<"post" | "cancel" | null>(null);
  const [comment, setComment] = useState("");
  if (!canUpdate) return null;
  const who = order.partner?.name ?? order.employee?.name ?? order.to_account?.name ?? "";
  return (
    <>
      {order.status === "draft" && <Button busy={post.isPending} onClick={() => setAsk("post")}><Check className="size-4" strokeWidth={2} /> O'tkazish</Button>}
      {order.status === "posted" && <Button variant="danger" busy={cancel.isPending} onClick={() => setAsk("cancel")}>Bekor qilish</Button>}
      <ConfirmDialog open={ask === "post"} onClose={() => setAsk(null)} title="Orderni o'tkazish" confirmLabel="O'tkazish" busy={post.isPending}
        text={`${money(order.amount)} ${unit(order.currency)} ${ORDER_KIND[order.kind].toLowerCase()}${who ? ` · ${who}` : ""} jurnalga o'tkaziladi, orderga raqam beriladi. Keyin o'zgartirib bo'lmaydi.`}
        onConfirm={() => post.mutate(undefined, { onSuccess: (o) => { setAsk(null); notifyOk(`O'tkazildi: ${o.code}`); }, onError: (e) => { setAsk(null); notifyError(e); } })} />
      <Dialog open={ask === "cancel"} onClose={() => setAsk(null)} title={`${order.code} ni bekor qilish`}
        footer={<>
          <Button variant="ghost" onClick={() => setAsk(null)}>Yopish</Button>
          <Button variant="danger" disabled={!comment.trim()} busy={cancel.isPending}
            onClick={() => cancel.mutate({ comment }, { onSuccess: () => { setAsk(null); setComment(""); notifyOk("Bekor qilindi"); }, onError: notifyError })}>Bekor qilish</Button>
        </>}>
        <p className="text-sm text-muted">O'tkazma {order.entry_code} storno qilinadi (ko'zgu o'tkazma yoziladi), order «bekor qilingan» bo'ladi. Sabab tarixga yoziladi.</p>
        <Textarea autoFocus rows={3} placeholder="Sabab…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
    </>
  );
}
