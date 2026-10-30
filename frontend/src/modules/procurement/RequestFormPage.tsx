import { Calculator, Check, ChevronDown, Circle, FileText, Plus, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle, StatusTrack } from "@/components/Record";
import { Button, Dialog, IconButton, Input, Menu, Pill, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDateTime, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { projectsApi } from "@/modules/projects/api";
import { ProductCombo, type LineProduct } from "@/modules/inventory/ProductCombo";

import { requestsApi, useOrdersFromRequests, useRequestActions, type FromRequestsLine, type PurchaseRequest, type RequestLine } from "./api";
import { REQUEST_PIPELINE, REQUEST_STATUS } from "./statuses";

type LineRow = { item_id: number | null; product: LineProduct | null; name: string; unit: string; qty: string; note: string };
type Values = { project_id: number | null; needed_by: string; notes: string; lines: LineRow[] };

const emptyLine = (): LineRow => ({ item_id: null, product: null, name: "", unit: "dona", qty: "", note: "" });
const EMPTY: Values = { project_id: null, needed_by: "", notes: "", lines: [] };

function linesError(rows: LineRow[]) {
  for (const r of rows) {
    if (!r.name.trim()) return "Har bir qatorda nomni yozing";
    if (!(toNum(r.qty) > 0)) return "Miqdor 0 dan katta bo'lishi kerak";
  }
  return null;
}

export function RequestFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("procurement");
  const canOrders = useCan("purchase_orders");
  const detail = requestsApi.useDetail(isNew ? undefined : id);
  const save = requestsApi.useSave();
  const remove = requestsApi.useRemove();
  const r = detail.data;
  const editable = (isNew ? can.create : can.update) && (!r || r.status === "draft");
  // "Yangi so'rov" from a Loyiha card: the picker needs the record to show its name before the first search
  const preset = projectsApi.useDetail(isNew && sp.get("project") ? sp.get("project")! : undefined);

  const form = useServerForm<Values, PurchaseRequest>({
    initial: { ...EMPTY, project_id: sp.get("project") ? Number(sp.get("project")) : null },
    record: r,
    toForm: (x) => ({
      project_id: x.project_id, needed_by: x.needed_by ?? "", notes: x.notes,
      lines: x.lines.map((l) => ({ item_id: l.item_id, product: l.product, name: l.name, unit: l.unit, qty: String(Number(l.qty)), note: l.note })),
    }),
    validate: { project_id: (v) => (v ? null : "Loyihani tanlang"), lines: linesError },
  });
  const v = form.values;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = {
      project_id: v.project_id, needed_by: v.needed_by || null, notes: v.notes,
      lines: v.lines.map((l) => ({ item_id: l.item_id, product_id: l.product?.id ?? null, name: l.name.trim(), unit: l.unit.trim() || "dona", qty: String(toNum(l.qty)), note: l.note })),
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/procurement/requests/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !r) return null;
  const ordered = r ? r.lines.reduce((s, l) => s + Number(l.ordered_qty), 0) : 0;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={r ? { model: "procurement.purchaserequest", id: r.id } : null}>
        <RecordNav listTo="/procurement/requests" listLabel="Xarid so'rovlari" crumb={r?.code ?? "Yangi"} navKey="procurement/requests" id={r?.id} />

        <ActionBar right={r && <StatusTrack steps={REQUEST_PIPELINE.map((s) => [s, REQUEST_STATUS[s].label])} current={r.status}
          off={r.status === "cancelled" || r.status === "rejected" ? REQUEST_STATUS[r.status].label : undefined} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {r && !form.dirty && <Actions request={r} canUpdate={can.update} canOrder={canOrders.create} />}
          {r?.status === "draft" && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              onConfirm={() => remove.mutate(r.id, { onSuccess: () => navigate("/procurement/requests"), onError: notifyError })} />
          )}
        </ActionBar>

        <Sheet>
          <SheetTitle eyebrow={r ? `Xarid so'rovi № ${r.code}` : "Yangi so'rov"}
            title={isNew ? "Yangi xarid so'rovi" : r!.project.name}
            smart={r && (
              <>
                <Smart icon={<FileText className="size-4" />} value={r.project.code} label="Loyiha" onClick={() => navigate(`/projects/${r.project_id}`)} />
                {canOrders.view && ordered > 0 && (
                  <Smart icon={<ShoppingCart className="size-4" />} value={`${r.lines.filter((l) => Number(l.ordered_qty) > 0).length} / ${r.lines.length}`}
                    label="Buyurtmada" onClick={() => navigate(`/procurement/orders?project=${r.project_id}`)} />
                )}
              </>
            )} />

          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Loyiha" required error={form.errors.project_id}>
                <EntitySelect endpoint="projects" current={r?.project ?? preset.data} disabled={!editable || !!r} error={form.errors.project_id}
                  value={v.project_id} onChange={(pid) => form.set("project_id", pid)} />
              </Row>
              <Row label="Kerak sana"><Input type="date" {...form.text("needed_by")} /></Row>
              <Row label="So'rovchi"><Input value={r?.requester?.full_name ?? "siz"} disabled /></Row>
              <Row label="Tasdiq">
                <Input value={r?.approved_at ? `${r.approved_by?.full_name ?? ""} · ${fmtDateTime(r.approved_at)}` : "—"} disabled />
              </Row>
              <Row label="Izoh" wide><Textarea {...form.text("notes")} placeholder="Masalan: AKFA 306 seriya, oq" /></Row>
            </FieldGrid>

            <FieldGrid title="Qatorlar">
              <Row label="Materiallar" wide>
                <LinesEditor rows={v.lines} disabled={!editable} error={form.errors.lines} saved={r?.lines}
                  onChange={(rows) => form.set("lines", rows)}
                  extra={r && editable && !form.dirty ? <FromCalc request={r} /> : null} />
              </Row>
            </FieldGrid>
          </fieldset>
          {r && (r.steps.length > 0 || r.approvals.length > 0) && <Approvals request={r} />}
        </Sheet>
      </RecordPage>
    </form>
  );
}

function LinesEditor({ rows, onChange, disabled, error, saved, extra }: {
  rows: LineRow[]; onChange: (rows: LineRow[]) => void; disabled: boolean; error?: string; saved?: RequestLine[]; extra?: React.ReactNode;
}) {
  const set = (i: number, patch: Partial<LineRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="w-8 px-3 py-2.5 font-medium">№</th>
              <th className="px-3 py-2.5 font-medium">Nomi</th>
              <th className="w-24 px-3 py-2.5 font-medium">Birlik</th>
              <th className="w-28 px-3 py-2.5 text-right font-medium">Miqdor</th>
              {disabled && saved && <th className="w-28 px-3 py-2.5 text-right font-medium">Buyurtmada</th>}
              <th className="w-48 px-3 py-2.5 font-medium">Izoh</th>
              {!disabled && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 text-xs text-muted">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <ProductCombo name={l.name} product={l.product} disabled={disabled}
                    onText={(name) => set(i, { name, product: null })}
                    onPick={(p) => set(i, { product: p, name: p.name, unit: p.unit })} />
                </td>
                <td className="px-2 py-1.5"><Input value={l.unit} disabled={disabled} onChange={(e) => set(i, { unit: e.target.value })} /></td>
                <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={l.qty} disabled={disabled} placeholder="0" onChange={(e) => set(i, { qty: e.target.value })} /></td>
                {disabled && saved && (
                  <td className="px-3 py-1.5 text-right tabular">
                    {saved[i] ? <span className={Number(saved[i].ordered_qty) >= Number(saved[i].qty) ? "text-ok" : Number(saved[i].ordered_qty) > 0 ? "text-warn" : "text-muted"}>{Number(saved[i].ordered_qty)}</span> : "—"}
                  </td>
                )}
                <td className="px-2 py-1.5"><Input value={l.note} disabled={disabled} onChange={(e) => set(i, { note: e.target.value })} /></td>
                {!disabled && (
                  <td className="px-1">
                    <IconButton label="Qatorni o'chirish" onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-5 text-center text-sm text-muted">Hali qator yo'q</td></tr>}
          </tbody>
          {!disabled && (
            <tfoot>
              <tr className="border-t border-line bg-ground/60">
                <td colSpan={7} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-4">
                    <button type="button" onClick={() => onChange([...rows, emptyLine()])}
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                      <Plus className="size-4" /> Qator qo'shish
                    </button>
                    {extra}
                  </div>
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

/** "Hisob-kitobdan olish": copy the lines of one of the Loyiha's calculations. */
function FromCalc({ request }: { request: PurchaseRequest }) {
  const project = projectsApi.useDetail(request.project_id);
  const { fromCalc } = useRequestActions();
  const calcs = project.data?.calcs ?? [];
  if (!calcs.length) return null;
  const take = (calcId: number) => fromCalc.mutate({ id: request.id, body: { calc_id: calcId } }, {
    onSuccess: (x) => notifyOk(`${x.lines.length} qator`), onError: notifyError,
  });
  if (calcs.length === 1) {
    return (
      <Button type="button" variant="soft" size="sm" busy={fromCalc.isPending} onClick={() => take(calcs[0].id)}>
        <Calculator className="size-4" /> Hisob-kitobdan olish
      </Button>
    );
  }
  return (
    <Menu trigger={() => <Button type="button" variant="soft" size="sm" busy={fromCalc.isPending}><Calculator className="size-4" /> Hisob-kitobdan olish <ChevronDown className="size-3.5" /></Button>}
      items={calcs.map((c) => ({ label: `${c.title} · ${Number(c.total).toLocaleString("ru-RU")} ${c.currency}`, onClick: () => take(c.id) }))} />
  );
}

function Actions({ request: r, canUpdate, canOrder }: { request: PurchaseRequest; canUpdate: boolean; canOrder: boolean }) {
  const a = useRequestActions();
  const [dialog, setDialog] = useState<"reject" | "cancel" | "order" | null>(null);
  const [comment, setComment] = useState("");
  const close = () => { setDialog(null); setComment(""); };
  const run = (m: { mutate: (x: { id: number; body: never }, o: object) => void }, body: unknown, msg: string) =>
    m.mutate({ id: r.id, body: body as never }, { onSuccess: () => { close(); notifyOk(msg); }, onError: notifyError });

  return (
    <>
      {canUpdate && r.status === "draft" && <Button busy={a.submit.isPending} onClick={() => run(a.submit, undefined, "Tasdiqlashga yuborildi")}>Tasdiqlashga yuborish</Button>}
      {r.can_approve && (
        <>
          <Button busy={a.approve.isPending} onClick={() => run(a.approve, {}, "Tasdiqlandi")}>
            <Check className="size-4" strokeWidth={1.75} /> {r.approval_step ? `Tasdiqlash · ${r.approval_step.name}` : "Tasdiqlash"}
          </Button>
          <Button variant="danger" onClick={() => setDialog("reject")}>Rad etish</Button>
        </>
      )}
      {canOrder && r.status === "approved" && <Button onClick={() => setDialog("order")}><ShoppingCart className="size-4" /> Buyurtma yaratish</Button>}
      {canUpdate && (r.status === "submitted" || r.status === "rejected") && (
        <Button variant="ghost" busy={a.reopen.isPending} onClick={() => run(a.reopen, undefined, "Qoralamaga qaytarildi")}>Qoralamaga qaytarish</Button>
      )}
      {canUpdate && (r.status === "draft" || r.status === "approved") && (
        <Button variant="ghost" className="text-bad" onClick={() => setDialog("cancel")}>Bekor qilish</Button>
      )}

      <Dialog open={dialog === "reject"} onClose={close} title="So'rovni rad etish"
        footer={<>
          <Button variant="ghost" onClick={close}>Yopish</Button>
          <Button variant="danger" disabled={!comment.trim()} busy={a.reject.isPending} onClick={() => run(a.reject, { comment }, "Rad etildi")}>Rad etish</Button>
        </>}>
        <p className="text-sm text-muted">Sabab so'rovchiga tarixda ko'rinadi.</p>
        <Textarea autoFocus rows={3} placeholder="Sabab…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
      <Dialog open={dialog === "cancel"} onClose={close} title="So'rovni bekor qilish"
        footer={<>
          <Button variant="ghost" onClick={close}>Yopish</Button>
          <Button variant="danger" busy={a.cancel.isPending} onClick={() => run(a.cancel, { comment }, "Bekor qilindi")}>Bekor qilish</Button>
        </>}>
        <Textarea autoFocus rows={3} placeholder="Sabab (ixtiyoriy)…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
      {dialog === "order" && <OrderDialog request={r} onClose={close} />}
    </>
  );
}

/** Pick a supplier per line (or one for all) → one draft order per supplier. */
function OrderDialog({ request, onClose }: { request: PurchaseRequest; onClose: () => void }) {
  const navigate = useNavigate();
  const create = useOrdersFromRequests();
  const open = useMemo(() => request.lines.filter((l) => Number(l.remaining_qty) > 0), [request.lines]);
  const [rows, setRows] = useState<Record<number, { supplier_id: number | null; qty: string; on: boolean }>>({});
  const [forAll, setForAll] = useState<number | null>(null);
  useEffect(() => {
    setRows(Object.fromEntries(open.map((l) => [l.id, { supplier_id: null, qty: String(Number(l.remaining_qty)), on: true }])));
  }, [open]);

  const lines: FromRequestsLine[] = open
    .filter((l) => rows[l.id]?.on && (rows[l.id]?.supplier_id || forAll))
    .map((l) => ({ request_line_id: l.id, supplier_id: (rows[l.id].supplier_id ?? forAll)!, qty: rows[l.id].qty || null }));
  const missing = open.filter((l) => rows[l.id]?.on && !(rows[l.id]?.supplier_id || forAll)).length;

  const go = () => create.mutate({ lines }, {
    onSuccess: (orders) => {
      notifyOk(orders.length === 1 ? `Buyurtma ${orders[0].code}` : `${orders.length} ta buyurtma yaratildi`);
      onClose();
      navigate(orders.length === 1 ? `/procurement/orders/${orders[0].id}` : `/procurement/orders?project=${request.project_id}`);
    },
    onError: notifyError,
  });

  return (
    <Dialog open onClose={onClose} title="Buyurtma yaratish" width="max-w-3xl"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button disabled={!lines.length || missing > 0} busy={create.isPending} onClick={go}>
          {new Set(lines.map((l) => l.supplier_id)).size > 1 ? `${new Set(lines.map((l) => l.supplier_id)).size} ta buyurtma yaratish` : "Yaratish"}
        </Button>
      </>}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Hammasi uchun:</span>
        <EntitySelect endpoint="procurement/suppliers" placeholder="Yetkazib beruvchi" className="w-72" value={forAll} onChange={(id) => setForAll(id)} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="w-8 px-2 py-2" /><th className="px-3 py-2 font-medium">Nomi</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Miqdor</th><th className="w-64 px-3 py-2 font-medium">Yetkazib beruvchi</th>
            </tr>
          </thead>
          <tbody>
            {open.map((l) => {
              const row = rows[l.id];
              if (!row) return null;
              const set = (patch: Partial<typeof row>) => setRows((p) => ({ ...p, [l.id]: { ...p[l.id], ...patch } }));
              return (
                <tr key={l.id} className={`border-b border-line last:border-0 ${row.on ? "" : "opacity-50"}`}>
                  <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={row.on} onChange={(e) => set({ on: e.target.checked })} className="size-4 accent-accent" /></td>
                  <td className="px-3 py-1.5"><div className="font-medium">{l.name}</div><div className="text-xs text-muted">qoldi {Number(l.remaining_qty)} {l.unit}</div></td>
                  <td className="px-2 py-1.5"><Input inputMode="decimal" className="text-right tabular" value={row.qty} disabled={!row.on} onChange={(e) => set({ qty: e.target.value })} /></td>
                  <td className="px-2 py-1.5">
                    <EntitySelect endpoint="procurement/suppliers" placeholder={forAll ? "hammasi kabi" : "Tanlang…"} disabled={!row.on}
                      value={row.supplier_id} onChange={(id) => set({ supplier_id: id })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {missing > 0 && <p className="text-xs text-warn">{missing} ta qatorda yetkazib beruvchi tanlanmagan.</p>}
    </Dialog>
  );
}

const STEP_TONE = {
  done: "border-ok/30 bg-ok-soft text-ok",
  current: "border-accent bg-accent text-white",
  pending: "border-line bg-surface text-muted",
  rejected: "border-bad/30 bg-bad-soft text-bad",
} as const;

/** Multi-level approval: the steps of the latest round and every decision ever made on the request. */
function Approvals({ request: r }: { request: PurchaseRequest }) {
  return (
    <div className="grid gap-3">
      <p className="t-label border-b border-line pb-2">Tasdiqlash</p>
      {r.steps.length > 0 && (
        <ol className="flex flex-wrap items-center gap-2" aria-label="Tasdiqlash bosqichlari">
          {r.steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-line-strong" aria-hidden />}
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${STEP_TONE[s.state]}`}>
                {s.state === "done" ? <Check className="size-3.5" strokeWidth={1.75} /> : s.state === "rejected" ? <X className="size-3.5" strokeWidth={1.75} /> : <Circle className="size-3" strokeWidth={1.75} />}
                {s.name}
                <span className={s.state === "current" ? "text-white/80" : "text-faint"}>· {s.role}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {r.approvals.length > 0 && (
        <ul className="grid gap-1.5 text-sm">
          {r.approvals.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <Pill tone={a.decision === "approved" ? "ok" : "bad"}>{a.decision === "approved" ? "Tasdiqlandi" : "Rad etildi"}</Pill>
              <span className="font-medium">{a.step_name || "Tasdiqlash"}</span>
              <span className="text-muted">{a.user?.full_name ?? "—"} · {fmtDateTime(a.created_at)}</span>
              {a.comment && <span className="text-muted">— {a.comment}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
