import dayjs from "dayjs";
import { BookOpen, Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, ConfirmDialog, IconButton, Input, Select, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { useCompany } from "@/modules/company/api";

import { invoicesApi, useInvoiceActions, usePartnerBalance, useRoles, type Currency, type Invoice, type InvoiceKind } from "./api";
import { INVOICE_KIND, INVOICE_STATUS, money } from "./labels";

type LineRow = { name: string; unit: string; qty: string; price: string; vat_rate: string; role: string };
type Values = {
  kind: InvoiceKind; partner_id: number | null; project_id: number | null; date: string; external_number: string;
  external_date: string; currency: Currency; rate: string; notes: string; lines: LineRow[];
};

const UNITS = ["dona", "kompl", "m", "m²", "kg", "xizmat"];
const CUSTOMER_ROLES = ["revenue_products", "revenue_services", "other_op_income"];
const SUPPLIER_ROLES = ["materials", "components", "goods", "admin_expense", "selling_expense", "other_op_expense", "wip"];

const lineRow = (kind: InvoiceKind, vat: string): LineRow => ({ name: "", unit: "dona", qty: "1", price: "", vat_rate: vat, role: kind === "customer" ? "revenue_products" : "admin_expense" });
const num = (v: string) => toNum(v || "0") || 0;
const lineNet = (l: LineRow) => Math.round(num(l.qty) * num(l.price) * 100) / 100;
const lineVat = (l: LineRow) => Math.round(lineNet(l) * num(l.vat_rate)) / 100;

export function InvoiceFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("invoices");
  const detail = invoicesApi.useDetail(isNew ? undefined : id);
  const save = invoicesApi.useSave();
  const remove = invoicesApi.useRemove();
  const company = useCompany();
  const roles = useRoles();
  const inv = detail.data;
  const vatDefault = company.data?.vat_payer ? String(Number(company.data.vat_rate)) : "0";
  const kindFromUrl = (sp.get("kind") as InvoiceKind | null) ?? "customer";

  const EMPTY: Values = {
    kind: kindFromUrl, partner_id: sp.get("partner") ? Number(sp.get("partner")) : null, project_id: sp.get("project") ? Number(sp.get("project")) : null,
    date: dayjs().format("YYYY-MM-DD"), external_number: "", external_date: "", currency: "UZS", rate: "", notes: "", lines: [lineRow(kindFromUrl, vatDefault)],
  };
  const form = useServerForm<Values, Invoice>({
    initial: EMPTY,
    record: inv,
    toForm: (r) => ({
      kind: r.kind, partner_id: r.partner_id, project_id: r.project_id, date: r.date, external_number: r.external_number,
      external_date: r.external_date ?? "", currency: r.currency, rate: r.rate ? String(Number(r.rate)) : "", notes: r.notes,
      lines: r.lines.map((l) => ({ name: l.name, unit: l.unit, qty: String(Number(l.qty)), price: String(Number(l.price)), vat_rate: String(Number(l.vat_rate ?? 0)), role: l.role })),
    }),
    validate: {
      partner_id: (v) => (v ? null : "Kontragentni tanlang"),
      date: (v) => (v ? null : "Sanani kiriting"),
      lines: (rows) => (!rows.length ? "Kamida bitta qator" : rows.some((r) => !r.name.trim() || !(num(r.qty) > 0) || !(num(r.price) >= 0)) ? "Har bir qatorda nom, miqdor va narx bo'lsin" : null),
      rate: (v, all) => (all.currency !== "UZS" && v && !(toNum(v) > 0) ? "Kurs noto'g'ri" : null),
    },
  });
  const v = form.values;
  const editable = (isNew ? can.create : can.update) && (!inv || inv.status === "draft");
  const balance = usePartnerBalance(inv?.partner_id ?? v.partner_id);
  const net = v.lines.reduce((s, l) => s + lineNet(l), 0);
  const vat = v.lines.reduce((s, l) => s + lineVat(l), 0);
  const setLine = (i: number, patch: Partial<LineRow>) => form.set("lines", v.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const roleOptions = (v.kind === "customer" ? CUSTOMER_ROLES : SUPPLIER_ROLES).map((k) => roles.data?.find((r) => r.key === k)).filter(Boolean) as { key: string; label: string; account: { code: string } }[];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = {
      ...v, external_date: v.external_date || null, rate: v.currency !== "UZS" && v.rate ? String(toNum(v.rate)) : null,
      lines: v.lines.map((l) => ({ name: l.name, unit: l.unit, qty: String(num(l.qty)), price: String(num(l.price)), vat_rate: String(num(l.vat_rate)), role: l.role })),
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => { notifyOk("Saqlandi"); form.commit(); if (isNew) navigate(`/accounting/invoices/${saved.id}`, { replace: true }); },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !inv) return null;
  const cur = v.currency === "UZS" ? "so'm" : v.currency;
  const advance = balance.data ? Number(v.kind === "customer" ? balance.data.advance_received : balance.data.advance_paid) : 0;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={inv ? { model: "accounting.invoice", id: inv.id } : null}>
        <RecordNav listTo="/accounting/invoices" listLabel="Hisob-fakturalar" crumb={inv?.code ?? "Yangi"} navKey="invoices" id={inv?.id} />
        <ActionBar right={inv && <StatusTrack steps={[["draft", "Qoralama"], ["confirmed", "Tasdiqlangan"]]} current={inv.status}
          off={inv.status === "cancelled" ? INVOICE_STATUS.cancelled.label : undefined} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {inv && !form.dirty && <Actions inv={inv} canUpdate={can.update} />}
          {inv?.status === "draft" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Qoralama hisob-faktura o'chiriladi."
              onConfirm={() => remove.mutate(inv.id, { onSuccess: () => navigate("/accounting/invoices"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow={inv ? `Hisob-faktura ${inv.code} · ${INVOICE_KIND[inv.kind]}` : "Yangi hisob-faktura"}
            title={inv ? inv.partner.name : INVOICE_KIND[v.kind]}
            smart={inv && (
              <>
                <Smart icon={<BookOpen className="size-4" />} value={money(inv.gross)} label={`Jami, ${inv.currency === "UZS" ? "so'm" : inv.currency}`} />
                {inv.entry_code && <Smart icon={<Check className="size-4" />} value={inv.entry_code} label="O'tkazma" onClick={() => navigate(`/accounting/entries/${inv.entry_id}`)} />}
                {balance.data && <Smart icon={<BookOpen className="size-4" />} value={<span className={Number(balance.data.net_uzs) > 0 ? "text-bad" : Number(balance.data.net_uzs) < 0 ? "text-ok" : ""}>{money(balance.data.net_uzs)}</span>} label="Kontragent saldosi" />}
              </>
            )} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Turi" required>
                <Select value={v.kind} disabled={!isNew} onChange={(e) => { const k = e.target.value as InvoiceKind; form.set("kind", k); form.set("lines", v.lines.map((l) => ({ ...l, role: k === "customer" ? "revenue_products" : "admin_expense" }))); }}>
                  <option value="customer">Mijozga (sotuv)</option>
                  <option value="supplier">Yetkazib beruvchidan (xarid)</option>
                </Select>
              </Row>
              <Row label="Sana" required error={form.errors.date}><Input type="date" {...form.text("date")} /></Row>
              <Row label="Kontragent" required error={form.errors.partner_id}>
                <EntitySelect endpoint="clients" current={inv?.partner} disabled={!editable} value={v.partner_id} onChange={(cid) => form.set("partner_id", cid)} />
              </Row>
              <Row label="Loyiha">
                <EntitySelect endpoint="projects" current={inv?.project} disabled={!editable} placeholder="—" value={v.project_id} onChange={(pid) => form.set("project_id", pid)} />
              </Row>
              <Row label="ESF №"><Input {...form.text("external_number")} placeholder="Soliq ESF raqami" /></Row>
              <Row label="ESF sanasi"><Input type="date" {...form.text("external_date")} /></Row>
              <Row label="Valyuta">
                <div className="flex gap-2">
                  <Select className="w-28" value={v.currency} onChange={(e) => form.set("currency", e.target.value as Currency)}><option value="UZS">so'm</option><option value="USD">USD</option></Select>
                  {v.currency !== "UZS" && <Input inputMode="decimal" className="tabular" placeholder="Kurs (bo'sh — MB kursi)" {...form.text("rate")} />}
                </div>
              </Row>
              <Row label="Izoh"><Textarea rows={1} {...form.text("notes")} /></Row>
            </FieldGrid>

            <div className="grid gap-2">
              <p className="t-label border-b border-line pb-2">Qatorlar</p>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                      <th className="w-8 px-3 py-2.5 font-medium">№</th>
                      <th className="min-w-56 px-2 py-2.5 font-medium">Nomi</th>
                      <th className="w-24 px-2 py-2.5 font-medium">Birlik</th>
                      <th className="w-24 px-2 py-2.5 text-right font-medium">Miqdor</th>
                      <th className="w-32 px-2 py-2.5 text-right font-medium">Narx</th>
                      {company.data?.vat_payer && <th className="w-20 px-2 py-2.5 text-right font-medium">QQS %</th>}
                      <th className="min-w-44 px-2 py-2.5 font-medium">{v.kind === "customer" ? "Daromad hisobi" : "Xarajat / aktiv"}</th>
                      <th className="w-32 px-2 py-2.5 text-right font-medium">Summa</th>
                      {editable && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {v.lines.map((l, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="px-3 text-xs tabular text-muted">{i + 1}</td>
                        <td className="px-2 py-1.5"><Input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><Input list="inv-units" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} /></td>
                        {company.data?.vat_payer && <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={l.vat_rate} onChange={(e) => setLine(i, { vat_rate: e.target.value })} /></td>}
                        <td className="px-2 py-1.5">
                          <Select value={l.role} onChange={(e) => setLine(i, { role: e.target.value })}>
                            {!roleOptions.some((r) => r.key === l.role) && l.role && <option value={l.role}>{l.role}</option>}
                            {roleOptions.map((r) => <option key={r.key} value={r.key}>{r.account.code} · {r.label}</option>)}
                          </Select>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular">{money(lineNet(l) + lineVat(l))}</td>
                        {editable && <td className="px-1"><IconButton label="O'chirish" onClick={() => form.set("lines", v.lines.filter((_, j) => j !== i))}><X className="size-4" /></IconButton></td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-ground/60 text-sm">
                      <td colSpan={editable ? (company.data?.vat_payer ? 7 : 6) : (company.data?.vat_payer ? 7 : 6)} className="px-3 py-2">
                        {editable && (
                          <button type="button" onClick={() => form.set("lines", [...v.lines, lineRow(v.kind, vatDefault)])} className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                            <Plus className="size-4" /> Qator qo'shish
                          </button>
                        )}
                      </td>
                      <td colSpan={editable ? 2 : 1} className="px-3 py-2 text-right">
                        <div className="grid justify-items-end gap-0.5 text-xs text-muted">
                          <span>Summa: <b className="tabular text-ink">{money(net)}</b></span>
                          {company.data?.vat_payer && <span>QQS: <b className="tabular text-ink">{money(vat)}</b></span>}
                          <span className="text-sm">Jami: <b className="tabular text-ink">{money(net + vat)} {cur}</b></span>
                          {advance > 0 && <span className="text-ok">Avans hisobga olinadi: {money(Math.min(advance, net + vat))}</span>}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <datalist id="inv-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
              </div>
              {form.errors.lines && <p className="text-xs font-medium text-bad">{form.errors.lines}</p>}
              {!company.data?.vat_payer && <p className="text-xs text-muted">Kompaniya QQS to'lovchi emas — qatorlarda QQS 0 %. Sozlamalar → Kompaniya.</p>}
            </div>
          </fieldset>
          {inv?.status === "confirmed" && inv.entry_id && (
            <p className="text-xs text-muted">Tasdiqlangan: qatorlar qulflangan. O'tkazma: <Link to={`/accounting/entries/${inv.entry_id}`} className="font-mono text-accent-ink hover:underline">{inv.entry_code}</Link>. Xato bo'lsa — «Bekor qilish» storno yozadi, keyin yangi hisob-faktura kiriting.</p>
          )}
        </Sheet>
      </RecordPage>
    </form>
  );
}

function Actions({ inv, canUpdate }: { inv: Invoice; canUpdate: boolean }) {
  const { confirm, cancel } = useInvoiceActions(inv.id);
  const [ask, setAsk] = useState<"confirm" | "cancel" | null>(null);
  if (!canUpdate) return null;
  return (
    <>
      {inv.status === "draft" && <Button busy={confirm.isPending} onClick={() => setAsk("confirm")}><Check className="size-4" strokeWidth={2} /> Tasdiqlash</Button>}
      {inv.status === "confirmed" && <Button variant="danger" busy={cancel.isPending} onClick={() => setAsk("cancel")}>Bekor qilish</Button>}
      <ConfirmDialog open={ask === "confirm"} onClose={() => setAsk(null)} title="Hisob-fakturani tasdiqlash" confirmLabel="Tasdiqlash" busy={confirm.isPending}
        text={`${money(inv.gross)} ${inv.currency === "UZS" ? "so'm" : inv.currency} jurnalga o'tkaziladi${inv.kind === "customer" ? " (Dt 4010 / Kt 9010, QQS)" : " (Dt xarajat, QQS / Kt 6010)"}; kontragentning avansi bo'lsa, hisobga olinadi.`}
        onConfirm={() => confirm.mutate(undefined, { onSuccess: () => { setAsk(null); notifyOk("Tasdiqlandi"); }, onError: notifyError })} />
      <ConfirmDialog open={ask === "cancel"} onClose={() => setAsk(null)} title="Hisob-fakturani bekor qilish" confirmLabel="Bekor qilish" danger busy={cancel.isPending}
        text={`O'tkazma ${inv.entry_code} storno qilinadi (ko'zgu o'tkazma yoziladi), hisob-faktura «bekor qilingan» bo'ladi.`}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: () => { setAsk(null); notifyOk("Bekor qilindi"); }, onError: notifyError })} />
    </>
  );
}
