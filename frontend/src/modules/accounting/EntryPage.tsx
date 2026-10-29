import dayjs from "dayjs";
import { Plus, Undo2, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, FieldGrid, RecordNav, RecordPage, Row, Sheet, SheetTitle } from "@/components/Record";
import { Button, Dialog, ErrorNote, IconButton, Input, Pill, Select } from "@/components/ui";
import { apiError } from "@/lib/api";
import { fmtDate, fmtDateTime, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { entriesApi, useAccounts, useReverseEntry, type Currency, type LineInput } from "./api";
import { ENTRY_STATUS, money, SOURCE_KIND, SOURCE_LINK } from "./labels";

type Row = { account_id: number | null; debit: string; credit: string; partner_id: number | null; project_id: number | null; memo: string; currency: Currency; amount_cur: string };
const emptyRow = (): Row => ({ account_id: null, debit: "", credit: "", partner_id: null, project_id: null, memo: "", currency: "UZS", amount_cur: "" });

export function EntryPage() {
  const { id } = useParams();
  if (id === "new") return <ManualEntryForm />;
  return <EntryView id={Number(id)} />;
}

function EntryView({ id }: { id: number }) {
  const can = useCan("accounting");
  const detail = entriesApi.useDetail(id);
  const reverse = useReverseEntry();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [memo, setMemo] = useState("");
  const e = detail.data;
  if (!e) return null;
  const link = e.source_model && e.source_id ? SOURCE_LINK[e.source_model]?.(e.source_id) : null;
  const canReverse = can.update && e.status === "posted" && e.source_kind !== "reversal";

  return (
    <RecordPage>
      <RecordNav listTo="/accounting" listLabel="Jurnal" crumb={e.code} navKey="accounting-entries" id={e.id} />
      <ActionBar right={<Pill tone={ENTRY_STATUS[e.status].tone}>{ENTRY_STATUS[e.status].label}</Pill>}>
        {canReverse && <Button variant="danger" onClick={() => setOpen(true)}><Undo2 className="size-4" strokeWidth={1.75} /> Storno</Button>}
        {e.reversed_by_code && <span className="text-sm text-muted">Storno: <Link className="font-mono text-accent-ink hover:underline" to={`/accounting?q=${e.reversed_by_code}`}>{e.reversed_by_code}</Link></span>}
        {e.reversal_of_code && <span className="text-sm text-muted">Asl o'tkazma: <Link className="font-mono text-accent-ink hover:underline" to={`/accounting?q=${e.reversal_of_code}`}>{e.reversal_of_code}</Link></span>}
        {link && <Link to={link} className="text-sm text-accent-ink hover:underline">{e.source_label}</Link>}
      </ActionBar>
      <Sheet>
        <SheetTitle eyebrow={`O'tkazma ${e.code} · ${SOURCE_KIND[e.source_kind]}`} title={e.memo || e.code} />
        <FieldGrid>
          <Row label="Sana"><div className="pt-2 text-sm">{fmtDate(e.date)}</div></Row>
          <Row label="Hujjat"><div className="pt-2 text-sm">{e.source_label || <span className="text-muted">—</span>}</div></Row>
          <Row label="Kim"><div className="pt-2 text-sm">{e.posted_by || "Tizim"} · {fmtDateTime(e.posted_at)}</div></Row>
          <Row label="Summa"><div className="pt-2 text-sm font-semibold tabular">{money(e.total_debit)}</div></Row>
        </FieldGrid>
        <LinesTable lines={e.lines} />
      </Sheet>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${e.code} ni storno qilish`}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Bekor qilish</Button>
          <Button variant="danger" busy={reverse.isPending} onClick={() => reverse.mutate({ id: e.id, date, memo }, {
            onSuccess: (m) => { setOpen(false); notifyOk(`Storno: ${m.code}`); navigate(`/accounting/entries/${m.id}`); },
            onError: notifyError,
          })}>Storno qilish</Button>
        </>}>
        <p className="text-sm text-muted">Debet va kredit almashtirilgan ko'zgu o'tkazma yoziladi; asl o'tkazma o'zgarmaydi, «storno qilingan» deb belgilanadi.</p>
        <label className="grid gap-1 text-sm"><span className="font-medium">Sana</span><Input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} /></label>
        <label className="grid gap-1 text-sm"><span className="font-medium">Izoh</span><Input placeholder={`Storno ${e.code}`} value={memo} onChange={(ev) => setMemo(ev.target.value)} /></label>
      </Dialog>
    </RecordPage>
  );
}

function LinesTable({ lines }: { lines: { id: number; account: { code: string; name: string }; debit: string; credit: string; partner: { id: number; name: string } | null; project: { id: number; code: string | null; name: string } | null; currency: string; amount_cur: string | null; rate: string | null; memo: string }[] }) {
  const hasCur = lines.some((l) => l.currency !== "UZS");
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-3 py-2.5 font-medium">Hisob</th>
            <th className="px-3 py-2.5 font-medium">Kontragent / Loyiha</th>
            <th className="px-3 py-2.5 font-medium">Izoh</th>
            {hasCur && <th className="px-3 py-2.5 text-right font-medium">Valyuta</th>}
            <th className="px-3 py-2.5 text-right font-medium">Debet</th>
            <th className="px-3 py-2.5 text-right font-medium">Kredit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-line last:border-0">
              <td className="whitespace-nowrap px-3 py-2"><b className="font-mono">{l.account.code}</b> <span className="text-muted">{l.account.name}</span></td>
              <td className="px-3 py-2 text-xs">
                {l.partner && <Link to={`/clients/${l.partner.id}`} className="text-accent-ink hover:underline">{l.partner.name}</Link>}
                {l.partner && l.project && " · "}
                {l.project && <Link to={`/projects/${l.project.id}`} className="font-mono text-accent-ink hover:underline">{l.project.code}</Link>}
              </td>
              <td className="px-3 py-2 text-xs text-muted">{l.memo}</td>
              {hasCur && <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular text-muted">{l.currency !== "UZS" && <>{money(l.amount_cur)} {l.currency} × {money(l.rate)}</>}</td>}
              <td className="whitespace-nowrap px-3 py-2 text-right tabular">{money(l.debit, true)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular">{money(l.credit, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Qo'lda o'tkazma: boshlang'ich qoldiqlar va tuzatishlar. */
function ManualEntryForm() {
  const navigate = useNavigate();
  const save = entriesApi.useSave();
  const accounts = useAccounts({ is_active: "true", allow_posting: "true" });
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [memo, setMemo] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const sum = (k: "debit" | "credit") => rows.reduce((s, r) => s + (toNum(r[k] || "0") || 0), 0);
  const dt = sum("debit"), kt = sum("credit");
  const balanced = dt > 0 && Math.abs(dt - kt) < 0.005;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memo.trim()) return setError("Mazmunini yozing");
    if (rows.some((r) => !r.account_id)) return setError("Har bir qatorda hisob tanlang");
    if (!balanced) return setError("O'tkazma balanslanmagan: debet va kredit teng bo'lishi kerak");
    const lines: LineInput[] = rows.map((r) => ({
      account_id: r.account_id!, debit: String(toNum(r.debit || "0")), credit: String(toNum(r.credit || "0")),
      partner_id: r.partner_id, project_id: r.project_id, memo: r.memo, currency: r.currency,
      amount_cur: r.currency !== "UZS" && r.amount_cur ? String(toNum(r.amount_cur)) : null,
    }));
    save.mutate({ data: { date, memo, lines } }, {
      onSuccess: (saved) => { notifyOk(`O'tkazildi: ${saved.code}`); navigate(`/accounting/entries/${saved.id}`, { replace: true }); },
      onError: (err) => setError(apiError(err).message),
    });
  };

  return (
    <form onSubmit={submit}>
      <RecordPage>
        <RecordNav listTo="/accounting" listLabel="Jurnal" crumb="Yangi o'tkazma" navKey="accounting-entries" />
        <ActionBar>
          <Button type="submit" busy={save.isPending}>O'tkazish</Button>
          <Button variant="ghost" onClick={() => navigate("/accounting")}>Bekor qilish</Button>
          <span className={`ml-auto text-sm tabular ${balanced ? "text-ok" : "text-muted"}`}>Dt {money(dt)} · Kt {money(kt)}{!balanced && dt + kt > 0 && <b className="ml-2 text-bad">farq {money(Math.abs(dt - kt))}</b>}</span>
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow="Qo'lda o'tkazma" title="Boshlang'ich qoldiq yoki tuzatish" />
          <FieldGrid>
            <Row label="Sana" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Row>
            <Row label="Mazmuni" required><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Boshlang'ich qoldiq 01.11.2026" /></Row>
          </FieldGrid>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="min-w-64 px-2 py-2.5 font-medium">Hisob</th>
                  <th className="w-36 px-2 py-2.5 text-right font-medium">Debet</th>
                  <th className="w-36 px-2 py-2.5 text-right font-medium">Kredit</th>
                  <th className="min-w-44 px-2 py-2.5 font-medium">Kontragent</th>
                  <th className="min-w-44 px-2 py-2.5 font-medium">Loyiha</th>
                  <th className="w-24 px-2 py-2.5 font-medium">Valyuta</th>
                  <th className="min-w-40 px-2 py-2.5 font-medium">Izoh</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-2 py-1.5">
                      <Select value={r.account_id ?? ""} onChange={(e) => set(i, { account_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">— hisob —</option>
                        {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={r.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? "" : r.credit })} /></td>
                    <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={r.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? "" : r.debit })} /></td>
                    <td className="px-2 py-1.5"><EntitySelect endpoint="clients" placeholder="—" value={r.partner_id} onChange={(id) => set(i, { partner_id: id })} /></td>
                    <td className="px-2 py-1.5"><EntitySelect endpoint="projects" placeholder="—" value={r.project_id} onChange={(id) => set(i, { project_id: id })} /></td>
                    <td className="px-2 py-1.5">
                      <div className="grid gap-1">
                        <Select value={r.currency} onChange={(e) => set(i, { currency: e.target.value as Currency })}><option value="UZS">so'm</option><option value="USD">USD</option></Select>
                        {r.currency !== "UZS" && <Input inputMode="decimal" className="tabular" placeholder="USD summa" value={r.amount_cur} onChange={(e) => set(i, { amount_cur: e.target.value })} />}
                      </div>
                    </td>
                    <td className="px-2 py-1.5"><Input value={r.memo} onChange={(e) => set(i, { memo: e.target.value })} /></td>
                    <td className="px-1"><IconButton label="O'chirish" disabled={rows.length <= 2} onClick={() => setRows(rows.filter((_, j) => j !== i))}><X className="size-4" /></IconButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-line bg-ground/60 px-3 py-2.5">
              <button type="button" onClick={() => setRows([...rows, emptyRow()])} className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                <Plus className="size-4" /> Qator qo'shish
              </button>
            </div>
          </div>
          <ErrorNote error={error} />
          <p className="text-xs text-muted">Boshlang'ich qoldiqlar: ish boshlangan kundan bir kun oldingi sana bilan, 8330 / 8710 ga qarshi; mijoz va yetkazib beruvchi qarzlarida kontragent va loyihani ko'rsating. Valyuta qatorida so'mdagi summa debet/kreditga, USD summasi alohida kiritiladi — kurs shu kundagi jadvaldan olinadi.</p>
        </Sheet>
      </RecordPage>
    </form>
  );
}
