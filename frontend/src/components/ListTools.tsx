// List tools (add-list-tools, ADR 0011): Excel export / import and batch operations for any list page.
//   const sel = useSelection(query);
//   <Toolbar action={<ExcelMenu resource="clients" query={query} selection={sel} />}>…</Toolbar>
//   <BulkBar resource="clients" selection={sel} />
//   <DataTable … selected={sel.ids} onSelect={sel.set} />
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { download } from "@/lib/download";
import { notifyError, notifyOk } from "@/lib/notify";

import { Button, Dialog, Menu, Select, Textarea } from "./ui";

type BulkParam = { name: string; label: string; options: { value: string; label: string }[] };
type BulkDef = { key: string; label: string; danger: boolean; comment: boolean; params: BulkParam[] };
type Meta = { export: boolean; import: { header: string; required: boolean; hint: string }[] | null; bulk: BulkDef[] };
type ImportRow = { row: number; ok: boolean; errors: string[]; label: string };
type ImportResult = { rows: ImportRow[]; created: number; total: number; dry_run: boolean };
type BulkResult = { action: string; done: number; done_ids: number[]; failed: { id: number; label: string; message: string }[] };

export type Selection = { ids: Set<number>; set: (ids: Set<number>) => void; clear: () => void };

const LIST_ONLY = new Set(["page", "size", "sort"]);
const filtersOf = (query: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(query).filter(([k]) => !LIST_ONLY.has(k)));

/** Selected row ids; cleared when the filter changes (paging keeps them). */
export function useSelection(query: Record<string, unknown>): Selection {
  const [ids, setIds] = useState<Set<number>>(new Set());
  const key = JSON.stringify(filtersOf(query));
  useEffect(() => setIds(new Set()), [key]);
  return useMemo(() => ({ ids, set: setIds, clear: () => setIds(new Set()) }), [ids]);
}

function useMeta(resource: string) {
  return useQuery({
    queryKey: ["tabular", resource],
    queryFn: async () => (await api.get<Meta>(`/${resource}/tabular/`)).data,
    staleTime: 5 * 60_000,
  });
}

/** "Excel ▾": export the filter or the selection, the import template, the import itself. */
export function ExcelMenu({ resource, query, selection, name }: {
  resource: string; query: Record<string, unknown>; selection?: Selection; name?: string;
}) {
  const meta = useMeta(resource).data;
  const [importing, setImporting] = useState(false);
  if (!meta || (!meta.export && !meta.import)) return null;
  const n = selection?.ids.size ?? 0;
  const run = (url: string, params: Record<string, unknown>) =>
    download(url, params, `${name ?? resource.replace(/\//g, "-")}.xlsx`).catch(notifyError);
  const items = [
    ...(meta.export ? [{ label: "Ro'yxatni yuklab olish", icon: <Download className="size-4 text-muted" />,
      onClick: () => run(`/${resource}/export/`, filtersOf(query)) }] : []),
    ...(meta.export && n ? [{ label: `Tanlanganlarni yuklab olish (${n})`, icon: <Download className="size-4 text-muted" />,
      onClick: () => run(`/${resource}/export/`, { ids: [...selection!.ids] }) }] : []),
    ...(meta.import ? [
      { label: "Excel'dan import…", icon: <Upload className="size-4 text-muted" />, onClick: () => setImporting(true) },
      { label: "Import shabloni", icon: <FileSpreadsheet className="size-4 text-muted" />,
        onClick: () => run(`/${resource}/import-template/`, {}) },
    ] : []),
  ];
  return (
    <>
      <Menu align="right" items={items}
        trigger={() => <Button variant="ghost"><FileSpreadsheet className="size-4" strokeWidth={1.75} /> Excel <ChevronDown className="size-3.5" /></Button>} />
      {importing && meta.import && <ImportDialog resource={resource} columns={meta.import} onClose={() => setImporting(false)} />}
    </>
  );
}

function ImportDialog({ resource, columns, onClose }: { resource: string; columns: NonNullable<Meta["import"]>; onClose: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const send = useMutation({
    mutationFn: async (dry: boolean) => {
      const body = new FormData();
      body.append("file", file!);
      body.append("dry_run", dry ? "true" : "false");
      return (await api.post<ImportResult>(`/${resource}/import/`, body)).data;
    },
    onSuccess: (r) => {
      setResult(r);
      if (!r.dry_run) {
        qc.invalidateQueries();
        notifyOk(`${r.created} ta yozuv qo'shildi`);
      }
    },
    onError: notifyError,
  });
  const bad = result?.rows.filter((r) => !r.ok) ?? [];
  const committed = result && !result.dry_run;

  return (
    <Dialog open onClose={onClose} title="Excel'dan import" width="max-w-2xl"
      footer={<>
        <Button variant="ghost" className="mr-auto" onClick={() => download(`/${resource}/import-template/`, {}).catch(notifyError)}>
          <FileSpreadsheet className="size-4" strokeWidth={1.75} /> Shablon
        </Button>
        <Button variant="ghost" onClick={onClose}>{committed ? "Yopish" : "Bekor qilish"}</Button>
        {!committed && (
          result?.dry_run && result.created > 0
            ? <Button busy={send.isPending} onClick={() => send.mutate(false)}>Import qilish ({result.created} ta)</Button>
            : <Button disabled={!file} busy={send.isPending} onClick={() => send.mutate(true)}>Tekshirish</Button>
        )}
      </>}>
      <p className="text-sm text-muted">
        Birinchi qator — ustun nomlari (shablondagidek). Har qator alohida tekshiriladi: xatosi borlari o'tkazib yuboriladi,
        qolganlari qo'shiladi. Avval «Tekshirish» — hech narsa saqlanmaydi.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {columns.map((c) => (
          <span key={c.header} title={c.hint} className={`rounded-md border px-2 py-0.5 text-2xs ${c.required ? "border-accent text-accent-ink" : "border-line text-muted"}`}>
            {c.header}{c.required && " *"}
          </span>
        ))}
      </div>
      <input ref={input} type="file" accept=".xlsx" className="hidden"
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
      <button type="button" onClick={() => input.current?.click()}
        className="press flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-ground/60 px-4 py-5 text-sm text-muted hover:border-accent hover:text-ink">
        <Upload className="size-4" strokeWidth={1.75} /> {file ? file.name : "Faylni tanlang (.xlsx)"}
        {file && <X className="size-4" onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }} />}
      </button>
      {result && (
        <div className="grid gap-2">
          <p className={`flex items-center gap-2 text-sm font-medium ${bad.length ? "text-warn" : "text-ok"}`}>
            {bad.length ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {result.dry_run ? `Tekshirildi: ${result.total} qator — ${result.created} tasi qo'shiladi` : `Qo'shildi: ${result.created} / ${result.total}`}
            {bad.length > 0 && `, ${bad.length} tasida xato`}
          </p>
          {bad.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="w-16 px-3 py-2 font-medium">Qator</th><th className="px-3 py-2 font-medium">Xato</th>
                </tr></thead>
                <tbody>
                  {bad.map((r) => (
                    <tr key={r.row} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5 tabular text-muted">{r.row}</td>
                      <td className="px-3 py-1.5 text-bad">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** The bar over the table while rows are selected: count, the list's batch actions, clear. */
export function BulkBar({ resource, selection }: { resource: string; selection: Selection }) {
  const meta = useMeta(resource).data;
  const qc = useQueryClient();
  const [ask, setAsk] = useState<BulkDef | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<BulkResult | null>(null);
  const run = useMutation({
    mutationFn: async (def: BulkDef) =>
      (await api.post<BulkResult>(`/${resource}/bulk/`, { action: def.key, ids: [...selection.ids], params })).data,
    onSuccess: (r) => {
      setAsk(null);
      qc.invalidateQueries();
      if (r.failed.length) setResult(r);
      else notifyOk(`${r.done} ta bajarildi`);
      selection.set(new Set(r.failed.map((f) => f.id)));  // what failed stays selected for another try
    },
    onError: notifyError,
  });
  const n = selection.ids.size;
  if (!n || !meta) return null;
  const open = (def: BulkDef) => {
    setParams(Object.fromEntries(def.params.map((p) => [p.name, p.options[0]?.value ?? ""])));
    setAsk(def);
  };
  const ready = ask && (!ask.comment || (params.comment ?? "").trim());

  return (
    <>
      <div className="sticky top-14 z-20 mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-accent bg-accent-soft px-3 py-2 text-sm">
        <b className="tabular text-accent-ink">{n} ta tanlandi</b>
        <span className="mx-1 h-4 w-px bg-line-strong" />
        {meta.bulk.map((b) => (
          <Button key={b.key} size="sm" variant={b.danger ? "danger" : "ghost"} onClick={() => open(b)}>{b.label}</Button>
        ))}
        {!meta.bulk.length && <span className="text-xs text-muted">Bu ro'yxatda guruh amallari yo'q — Excel menyusidan yuklab olish mumkin.</span>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={selection.clear}><X className="size-3.5" /> Tozalash</Button>
      </div>
      <Dialog open={!!ask} onClose={() => setAsk(null)} title={ask ? `${ask.label}: ${n} ta yozuv` : ""}
        footer={<>
          <Button variant="ghost" onClick={() => setAsk(null)}>Bekor qilish</Button>
          <Button variant={ask?.danger ? "danger" : "primary"} disabled={!ready} busy={run.isPending} onClick={() => ask && run.mutate(ask)}>
            {ask?.label}
          </Button>
        </>}>
        <p className="text-sm text-muted">
          Har bir yozuv alohida bajariladi — xuddi o'z sahifasidagi tugma kabi. Bajarilmaganlari ro'yxat bilan ko'rsatiladi va tanlangan holda qoladi.
        </p>
        {ask?.params.map((p) => (
          <label key={p.name} className="grid gap-1 text-sm">
            <span className="font-medium text-muted">{p.label}</span>
            <Select value={params[p.name] ?? ""} onChange={(e) => setParams({ ...params, [p.name]: e.target.value })}>
              {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </label>
        ))}
        {ask?.comment && (
          <Textarea autoFocus rows={3} placeholder="Sabab…" value={params.comment ?? ""} onChange={(e) => setParams({ ...params, comment: e.target.value })} />
        )}
      </Dialog>
      <Dialog open={!!result} onClose={() => setResult(null)} title="Natija" width="max-w-xl"
        footer={<Button onClick={() => setResult(null)}>Yopish</Button>}>
        {result && (
          <>
            <p className="text-sm"><b className="text-ok">{result.done} ta bajarildi</b>, <b className="text-bad">{result.failed.length} tasi bajarilmadi</b>:</p>
            <ul className="grid max-h-72 gap-1 overflow-y-auto text-sm">
              {result.failed.map((f) => (
                <li key={f.id} className="rounded-lg bg-bad-soft/50 px-3 py-1.5"><b className="font-mono text-xs">{f.label}</b> — {f.message}</li>
              ))}
            </ul>
          </>
        )}
      </Dialog>
    </>
  );
}
