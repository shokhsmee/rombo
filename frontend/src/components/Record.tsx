// Record (form) page pieces, laid out like uzbridge's booking page:
//   breadcrumb + record pager · action bar with status track · the sheet · chatter column on the right.
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { recordNav } from "@/lib/recordNav";
import { nameCurrent, useTrail } from "@/lib/trail";

import { ChatterPanel, ChatterReopen, useChatterOpen } from "./Chatter";
import { Button, ConfirmDialog } from "./ui";

/** Two columns on wide screens: the record and its history. */
export function RecordPage({ chatter, children }: { chatter?: { model: string; id: number } | null; children: ReactNode }) {
  const [open] = useChatterOpen();
  const side = !!chatter && open;
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] gap-4 ${side ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">{children}</div>
      {chatter && open && (
        <aside className="min-w-0 xl:sticky xl:top-[69px] xl:max-h-[calc(100vh-90px)] xl:overflow-y-auto">
          <ChatterPanel model={chatter.model} id={chatter.id} />
        </aside>
      )}
      {chatter && !open && <ChatterReopen model={chatter.model} id={chatter.id} />}
    </div>
  );
}

/** "← Loyihalar / LY-26-00004" … "3 / 12 ‹ ›" */
export function RecordNav({ listTo, listLabel, crumb, navKey, id }: {
  listTo: string; listLabel: string; crumb: ReactNode; navKey: string; id?: number;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const trail = useTrail();
  const nav = id ? recordNav(navKey, id) : null;
  const btn = "press grid size-8 place-items-center rounded-md border border-line bg-surface text-muted hover:text-ink disabled:opacity-40";
  // the record names its breadcrumb ("LY-26-00007"); with a trail above, the list link would repeat it
  const label = typeof crumb === "string" || typeof crumb === "number" ? String(crumb) : listLabel;
  useEffect(() => nameCurrent(pathname, label), [pathname, label]);
  const deep = trail.length > 1;
  // the pager swaps the last crumb instead of piling records onto the trail
  const go = (to: string) => navigate(to, { replace: true });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!deep && (
        <>
          <Link to={listTo} className="inline-flex items-center gap-1 text-sm text-accent-ink hover:underline">
            <ArrowLeft className="size-4" /> {listLabel}
          </Link>
          <span className="text-sm text-muted">/ {crumb}</span>
        </>
      )}
      {nav && nav.pos >= 0 && nav.total > 1 && (
        <div className="ml-auto flex items-center gap-1 text-sm">
          <span className="tabular text-muted">{nav.pos + 1} / {nav.total}</span>
          <button type="button" className={btn} disabled={!nav.prev} onClick={() => nav.prev && go(`${listTo}/${nav.prev}`)} aria-label="Oldingi">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className={btn} disabled={!nav.next} onClick={() => nav.next && go(`${listTo}/${nav.next}`)} aria-label="Keyingi">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** The bar of actions above the sheet; `right` holds the status track. */
export function ActionBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-[54px] flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
      {children}
      {right && <div className="no-scrollbar ml-auto max-w-full overflow-x-auto">{right}</div>}
    </div>
  );
}

/** Save / discard, shown only when the form has unsaved changes. */
export function SaveButtons({ dirty, saving, isNew, onReset }: { dirty: boolean; saving: boolean; isNew?: boolean; onReset: () => void }) {
  if (!dirty && !isNew) return null;
  return (
    <>
      <Button type="submit" busy={saving}>Saqlash</Button>
      {dirty && <Button variant="ghost" onClick={onReset}>Bekor qilish</Button>}
    </>
  );
}

export function DeleteButton({ onConfirm, text = "Yozuv arxivga o'tkaziladi. Davom etasizmi?", busy }: {
  onConfirm: () => void; text?: ReactNode; busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" className="text-bad hover:text-bad" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" strokeWidth={1.75} /> O'chirish
      </Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => { onConfirm(); setOpen(false); }}
        title="O'chirishni tasdiqlang" text={text} confirmLabel="O'chirish" danger busy={busy} />
    </>
  );
}

/** Segmented status track: done steps soft, the current one filled. */
export function StatusTrack({ steps, current, off }: { steps: [string, string][]; current: string; off?: ReactNode }) {
  if (off) return <span className="inline-flex rounded-lg bg-bad-soft px-3 py-2 text-xs font-medium text-bad">{off}</span>;
  const at = steps.findIndex(([k]) => k === current);
  return (
    <div className="flex overflow-hidden rounded-lg border border-line text-xs" aria-label="Bosqichlar">
      {steps.map(([k, label], i) => (
        <span key={k} className={`whitespace-nowrap px-3 py-2 ${i ? "border-l border-line" : ""} ${
          k === current ? "bg-accent font-semibold text-white" : i < at ? "bg-accent-soft text-accent-ink" : "bg-surface text-muted"}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

/** The record's main card. */
export function Sheet({ children }: { children: ReactNode }) {
  return <section className="grid gap-5 rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">{children}</section>;
}

export function SheetTitle({ eyebrow, title, smart }: { eyebrow?: ReactNode; title: ReactNode; smart?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-medium text-muted">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {smart && <div className="flex flex-wrap justify-end gap-1.5">{smart}</div>}
    </div>
  );
}

/** Odoo form layout: two columns of label-left rows. */
export function FieldGrid({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      {title && <p className="t-label border-b border-line pb-2">{title}</p>}
      <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">{children}</div>
    </div>
  );
}

export function Row({ label, required, error, children, wide }: {
  label: string; required?: boolean; error?: string; children: ReactNode; wide?: boolean;
}) {
  return (
    <div className={`grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-3 ${wide ? "lg:col-span-2" : ""}`}>
      <span className="pt-2 text-sm font-medium text-muted">{label}{required && <span className="text-bad"> *</span>}</span>
      <span className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
        {children}
        {error && <span className="text-xs font-medium text-bad">{error}</span>}
      </span>
    </div>
  );
}
