// Konstruksiya muharriri: pick a template, set the outer size, click a cell to split it or to choose its
// filling and opening. The right column shows what the engine makes of it (pieces, glass, price) live.
import {
  AlertTriangle, Columns2, Copy, DoorOpen, LayoutTemplate, Lock, Minus, Plus, Redo2, Rows2, Undo2, Ungroup,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, RecordNav, RecordPage, Sheet } from "@/components/Record";
import { Button, Dialog, Field, IconButton, Input, Kpi, Segmented, Select, Textarea } from "@/components/ui";
import { apiError } from "@/lib/api";
import { fmtMoney, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { pricingApi } from "@/modules/pricing/api";
import { projectsApi } from "@/modules/projects/api";
import { RefSelect } from "@/modules/references/RefSelect";

import { constructionsApi, systemsApi, useDuplicate, useInvalidateProject, usePreview, type Preview } from "./api";
import {
  cellAt, defaultDesign, FILL_LABEL, isSplit, mergeParent, MIN_CELL, pathKey, resizeOuter, resizePart, SASH_LABEL,
  spanOf, splitCell, TEMPLATES, updateCell, type Design, type Fill, type Hinge, type Leaf, type Path, type SashType,
} from "./design";
import { ResultPanel } from "./ResultPanel";
import { DEFAULT_WIDTHS, WindowDrawing, type Widths } from "./WindowDrawing";

type Sel = { path: Path; kind: "leaf" | "split" };
type Meta = { name: string; system_id: number | null; product_type_id: number | null; count: number; notes: string };

const EDITABLE = ["draft", "confirmed"];

export function ConstructionEditorPage() {
  const { id, cid } = useParams();
  const projectId = Number(id);
  const isNew = cid === "new";
  const navigate = useNavigate();
  const can = useCan("constructions");
  const project = projectsApi.useDetail(projectId);
  const detail = constructionsApi.useDetail(isNew ? undefined : cid);
  const systems = systemsApi.useList({ is_active: true, size: 100 });
  const save = constructionsApi.useSave();
  const remove = constructionsApi.useRemove();
  const duplicate = useDuplicate();
  const invalidate = useInvalidateProject();
  const c = detail.data;
  const p = project.data;

  const [design, setDesignRaw] = useState<Design>(defaultDesign);
  const [meta, setMeta] = useState<Meta>({ name: "", system_id: null, product_type_id: null, count: 1, notes: "" });
  const [clean, setClean] = useState<string>("");
  const [sel, setSel] = useState<Sel | null>({ path: [1], kind: "leaf" });
  const [past, setPast] = useState<Design[]>([]);
  const [future, setFuture] = useState<Design[]>([]);
  const [templates, setTemplates] = useState(isNew);

  // load the record (or defaults for a new one) once
  useEffect(() => {
    if (c) {
      setDesignRaw(c.design);
      const m = { name: c.name, system_id: c.system_id, product_type_id: c.product_type_id, count: c.count, notes: c.notes };
      setMeta(m);
      setClean(JSON.stringify([c.design, m]));
      setSel(null);
    }
  }, [c]);
  useEffect(() => {
    if (isNew && !meta.system_id && systems.data?.items.length) {
      setMeta((m) => ({ ...m, system_id: systems.data!.items[0].id }));
    }
  }, [isNew, systems.data, meta.system_id]);

  const system = systemsApi.useDetail(meta.system_id ?? undefined).data;
  const priceList = pricingApi.useDetail(system?.price_list_id).data;
  const glassItems = (priceList?.items ?? []).filter((i) => i.is_active && /^(м2|m2|м кв|м²)$/i.test(i.unit.trim()) && /стекл|oyna|steklo/i.test(i.name));
  const widths: Widths = system
    ? { frame: Number(system.frame_width), mullion: Number(system.mullion_width), sash: Number(system.sash_width), overlap: Number(system.sash_overlap) }
    : DEFAULT_WIDTHS;

  const setDesign = useCallback((next: Design | ((d: Design) => Design)) => {
    setDesignRaw((cur) => {
      const d = typeof next === "function" ? next(cur) : next;
      if (JSON.stringify(d) !== JSON.stringify(cur)) {
        setPast((ps) => [...ps.slice(-49), cur]);
        setFuture([]);
      }
      return d;
    });
  }, []);
  const undo = () => past.length && (setFuture((f) => [design, ...f]), setDesignRaw(past[past.length - 1]), setPast((ps) => ps.slice(0, -1)));
  const redo = () => future.length && (setPast((ps) => [...ps, design]), setDesignRaw(future[0]), setFuture((f) => f.slice(1)));

  const locked = !!p && !EDITABLE.includes(p.status);
  const editable = (isNew ? can.create : can.update) && !locked;
  const dirty = isNew || JSON.stringify([design, meta]) !== clean;

  // live engine preview (debounced)
  const preview = usePreview();
  const [result, setResult] = useState<Preview | null>(null);
  const [error, setError] = useState<{ message: string; path: string | null } | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    if (!meta.system_id) return;
    const n = ++seq.current;
    const t = window.setTimeout(() => {
      preview.mutate({ system_id: meta.system_id!, design, count: meta.count || 1 }, {
        onSuccess: (r) => { if (n === seq.current) { setResult(r); setError(null); } },
        onError: (e) => {
          if (n !== seq.current) return;
          const err = apiError(e);
          setError({ message: err.message, path: err.field?.startsWith("design.") ? err.field.slice(7) : null });
        },
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [design, meta.system_id, meta.count]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if (e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const submit = () => {
    if (!meta.system_id) return notifyError({ response: { data: { error: { message: "Profil tizimini tanlang" } } } });
    const data = { project_id: projectId, system_id: meta.system_id, product_type_id: meta.product_type_id, name: meta.name,
      count: meta.count, notes: meta.notes, design };
    save.mutate({ id: isNew ? undefined : cid, data }, {
      onSuccess: (saved) => {
        notifyOk("Konstruksiya saqlandi");
        invalidate();
        setClean(JSON.stringify([saved.design, { name: saved.name, system_id: saved.system_id, product_type_id: saved.product_type_id, count: saved.count, notes: saved.notes }]));
        if (isNew) navigate(`/projects/${projectId}/constructions/${saved.id}`, { replace: true });
      },
      onError: (e) => {
        const err = apiError(e);
        if (err.field?.startsWith("design.")) setError({ message: err.message, path: err.field.slice(7) });
        notifyError(e);
      },
    });
  };

  if (!p || (!isNew && !c)) return null;
  const leaf = sel?.kind === "leaf" ? (cellAt(design.root, sel.path) as Leaf) : null;
  const selKey = sel ? pathKey(sel.path) : null;
  const currency = Object.keys(result?.totals ?? {})[0] ?? system?.price_list.currency ?? "USD";
  const total = result ? Number(result.totals[currency] ?? 0) : 0;

  return (
    <RecordPage chatter={c ? { model: "konstruktor.construction", id: c.id } : null}>
      <RecordNav listTo="/projects" listLabel="Loyihalar" navKey="construction" crumb={
        <><Link to={`/projects/${projectId}`} className="hover:underline">{p.code}</Link> / {c ? `${c.code} ${c.name}` : "Yangi konstruksiya"}</>} />

      <ActionBar right={
        <div className="flex items-center gap-2">
          <Kpi label="Maydon" value={`${(design.w * design.h / 1e6).toFixed(2)} m²`} sub={meta.count > 1 ? `× ${meta.count} = ${(design.w * design.h / 1e6 * meta.count).toFixed(2)} m²` : undefined} />
          <Kpi label="Narx (taxminiy)" value={result ? fmtMoney(total, currency) : "…"} sub={meta.count > 1 ? `${meta.count} dona uchun` : "1 dona"} />
        </div>
      }>
        {editable && dirty && <Button onClick={submit} busy={save.isPending} disabled={!!error}>Saqlash</Button>}
        {editable && dirty && !isNew && c && (
          <Button variant="ghost" onClick={() => { setDesignRaw(c.design); setMeta({ name: c.name, system_id: c.system_id, product_type_id: c.product_type_id, count: c.count, notes: c.notes }); }}>Bekor qilish</Button>
        )}
        {editable && (
          <>
            <IconButton label="Orqaga (Ctrl+Z)" disabled={!past.length} onClick={undo}><Undo2 className="size-4" strokeWidth={1.75} /></IconButton>
            <IconButton label="Qaytarish (Ctrl+Y)" disabled={!future.length} onClick={redo}><Redo2 className="size-4" strokeWidth={1.75} /></IconButton>
            <Button variant="ghost" onClick={() => setTemplates(true)}><LayoutTemplate className="size-4" strokeWidth={1.75} /> Shablon</Button>
          </>
        )}
        {c && !dirty && can.create && !locked && (
          <Button variant="ghost" busy={duplicate.isPending} onClick={() => duplicate.mutate(c.id, {
            onSuccess: (d) => { notifyOk(`Nusxa: ${d.code}`); navigate(`/projects/${projectId}/constructions/${d.id}`); }, onError: notifyError })}>
            <Copy className="size-4" strokeWidth={1.75} /> Nusxa
          </Button>
        )}
        {c && !dirty && can.delete && !locked && (
          <DeleteButton busy={remove.isPending} text="Konstruksiya o'chiriladi, Loyiha buyumlari qayta hisoblanadi."
            onConfirm={() => remove.mutate(c.id, { onSuccess: () => { invalidate(); navigate(`/projects/${projectId}`); }, onError: notifyError })} />
        )}
      </ActionBar>

      {locked && (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-sunk/60 px-3 py-2 text-sm text-muted">
          <Lock className="size-4" strokeWidth={1.75} /> Loyiha ishlab chiqarish bosqichida — chizma qulflangan.
        </p>
      )}
      {system?.needs_check && (
        <p className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
          <AlertTriangle className="size-4 shrink-0" strokeWidth={1.75} />
          «{system.name}» o'lchamlari sex tomonidan hali tasdiqlanmagan — kesish uzunliklarini tekshirib turing.
        </p>
      )}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Sheet>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Eni, mm" className="w-28">
              <MmInput value={design.w} disabled={!editable} onCommit={(w) => setDesign((d) => resizeOuter(d, w, d.h))} />
            </Field>
            <Field label="Bo'yi, mm" className="w-28">
              <MmInput value={design.h} disabled={!editable} onCommit={(h) => setDesign((d) => resizeOuter(d, d.w, h))} />
            </Field>
            <Field label="Soni" className="w-32">
              <Stepper value={meta.count} disabled={!editable} onChange={(count) => setMeta({ ...meta, count })} />
            </Field>
            <p className="ml-auto max-w-xs text-xs text-muted">Katakni bosing — bo'ling, oyna yoki tabaqa tanlang. Impostni bosing — qismlar o'lchamini o'zgartiring.</p>
          </div>

          <div className="grid place-items-center rounded-xl border border-line bg-ground/60 p-3" onClick={() => setSel(null)}>
            <WindowDrawing design={design} widths={widths} selected={selKey} errorPath={error?.path ?? null}
              cells={result?.result.cells} className="h-[min(62vh,640px)] w-full"
              onSelect={(path, kind) => setSel({ path, kind })} />
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-bad/20 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
              <AlertTriangle className="size-4 shrink-0" strokeWidth={1.75} /> {error.message}
            </p>
          )}
        </Sheet>

        <div className="grid content-start gap-3">
          <Panel title={sel ? (sel.kind === "leaf" ? `Katak ${leafNumber(design, sel.path)}` : "Impost — qismlar") : "Katakni tanlang"}>
            {!sel && <p className="text-sm text-muted">Chizmadagi katakni yoki impostni bosing.</p>}
            {sel?.kind === "split" && (
              <SplitInspector design={design} path={sel.path} disabled={!editable} onChange={setDesign}
                onMerge={() => { const r = mergeParent(design, [...sel.path, 0]); setDesign(r.design); setSel({ path: r.path, kind: "leaf" }); }} />
            )}
            {sel?.kind === "leaf" && leaf && (
              <LeafInspector design={design} path={sel.path} leaf={leaf} disabled={!editable} glassItems={glassItems}
                defaultGlass={system?.default_glass_id ?? null}
                onChange={(fn) => setDesign((d) => updateCell(d, sel.path, (cell) => fn(cell as Leaf)))}
                onSplit={(dir, n) => { setDesign((d) => splitCell(d, sel.path, dir, n)); setSel({ path: [...sel.path, 0], kind: "leaf" }); }}
                onMerge={sel.path.length ? () => { const r = mergeParent(design, sel.path); setDesign(r.design); setSel({ path: r.path, kind: "leaf" }); } : undefined} />
            )}
          </Panel>

          <ResultPanel preview={result} busy={preview.isPending} currency={currency} />

          <Panel title="Konstruksiya">
            <fieldset disabled={!editable} className="grid gap-3">
              <Field label="Nomi"><Input placeholder="Mehmonxona derazasi" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
              <Field label="Profil tizimi" required>
                <Select value={meta.system_id ?? ""} onChange={(e) => setMeta({ ...meta, system_id: Number(e.target.value) || null })}>
                  {(systems.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Buyurtma turi" hint={!meta.product_type_id && system?.product_type ? `Tizimdan: ${system.product_type.name}` : undefined}>
                <RefSelect kind="product_type" value={meta.product_type_id} onChange={(x) => setMeta({ ...meta, product_type_id: x })} />
              </Field>
              <Field label="Izoh"><Textarea rows={2} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></Field>
            </fieldset>
          </Panel>
        </div>
      </div>

      <Dialog open={templates && editable} onClose={() => setTemplates(false)} title="Shablon tanlang" width="max-w-3xl">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button key={t.key} type="button" onClick={() => { setDesign(structuredClone(t.design)); setSel(null); setTemplates(false); }}
              className="press grid gap-2 rounded-xl border border-line bg-surface p-3 text-left hover:border-accent">
              <WindowDrawing design={t.design} compact className="h-28 w-full" />
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-xs text-muted tabular">{t.design.w} × {t.design.h}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Shablondan keyin o'lcham va kataklarni o'zgartirasiz.</p>
      </Dialog>
    </RecordPage>
  );
}

function leafNumber(d: Design, path: Path): number {
  let n = 0, found = 0;
  const walk = (c: Design["root"], p: Path) => {
    if (!isSplit(c)) { n += 1; if (pathKey(p) === pathKey(path)) found = n; return; }
    c.cells.forEach((ch, i) => walk(ch, [...p, i]));
  };
  walk(d.root, []);
  return found;
}

export function Panel({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2"><h2 className="t-label">{title}</h2>{right}</div>
      {children}
    </section>
  );
}

/** A mm input that applies on blur / Enter, so typing "1" on the way to "1200" doesn't resize the frame. */
function MmInput({ value, onCommit, disabled, min = 300, max = 6000 }: { value: number; onCommit: (v: number) => void; disabled?: boolean; min?: number; max?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(Math.round(value))), [value]);
  const bad = !(toNum(text) >= min && toNum(text) <= max);
  const commit = () => { if (!bad && Math.round(toNum(text)) !== Math.round(value)) onCommit(Math.round(toNum(text))); };
  return (
    <Input inputMode="numeric" className="text-right tabular" value={text} disabled={disabled} error={bad ? `${min}–${max}` : undefined}
      onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
      onFocus={(e) => e.target.select()} />
  );
}

function Stepper({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex h-9 items-center rounded-lg border border-line bg-surface">
      <IconButton label="Kamaytirish" disabled={disabled || value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><Minus className="size-4" /></IconButton>
      <input className="w-full bg-transparent text-center text-sm font-semibold tabular outline-none" value={value} disabled={disabled}
        inputMode="numeric" onChange={(e) => { const n = Math.floor(toNum(e.target.value)); if (n >= 1 && n <= 999) onChange(n); }} />
      <IconButton label="Ko'paytirish" disabled={disabled || value >= 999} onClick={() => onChange(value + 1)}><Plus className="size-4" /></IconButton>
    </div>
  );
}

const SASH_OPTIONS: { value: SashType | "fixed"; label: string }[] = [
  { value: "fixed", label: "Qo'zg'almas" },
  { value: "turn", label: SASH_LABEL.turn },
  { value: "tilt_turn", label: SASH_LABEL.tilt_turn },
  { value: "tilt", label: SASH_LABEL.tilt },
  { value: "door", label: SASH_LABEL.door },
];

function LeafInspector({ design, path, leaf, disabled, glassItems, defaultGlass, onChange, onSplit, onMerge }: {
  design: Design; path: Path; leaf: Leaf; disabled: boolean; glassItems: { id?: number; name: string; price: string }[];
  defaultGlass: number | null; onChange: (fn: (l: Leaf) => Leaf) => void; onSplit: (dir: "v" | "h", n: number) => void; onMerge?: () => void;
}) {
  const { w, h } = spanOf(design, path);
  const [parts, setParts] = useState(2);
  const fill = leaf.fill ?? "glass";
  const sashType = leaf.sash?.type ?? "fixed";
  const canV = w / parts >= MIN_CELL, canH = h / parts >= MIN_CELL;
  return (
    <fieldset disabled={disabled} className="grid gap-4">
      <p className="text-xs text-muted tabular">Katak o'lchami: {Math.round(w)} × {Math.round(h)} mm</p>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Ochilishi</span>
        <div className="grid grid-cols-5 gap-1.5">
          {SASH_OPTIONS.map((o) => (
            <button key={o.value} type="button" title={o.label}
              onClick={() => onChange((l) => (o.value === "fixed" ? { ...l, sash: null }
                : { ...l, sash: { type: o.value as SashType, hinge: o.value === "tilt" ? "bottom" : (l.sash?.hinge === "right" ? "right" : "left") } }))}
              className={`press grid place-items-center gap-1 rounded-lg border p-1.5 text-2xs ${sashType === o.value ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted hover:border-line-strong"}`}>
              <SashIcon type={o.value} />
              <span className="leading-tight">{o.label}</span>
            </button>
          ))}
        </div>
        {leaf.sash?.type === "tilt" && (
          <div className="flex items-center gap-2 pt-1 text-sm">
            <span className="text-muted">Lup tomoni</span>
            <Segmented size="sm" value={leaf.sash.hinge === "top" ? "top" : "bottom"} onChange={(hinge: Hinge) => onChange((l) => ({ ...l, sash: { ...l.sash!, hinge } }))}
              options={[{ value: "bottom", label: "Pastda" }, { value: "top", label: "Tepada" }]} />
          </div>
        )}
        {leaf.sash && leaf.sash.type !== "tilt" && (
          <div className="flex items-center gap-2 pt-1 text-sm">
            <span className="text-muted">Lup tomoni</span>
            <Segmented size="sm" value={leaf.sash.hinge === "right" ? "right" : "left"} onChange={(hinge: Hinge) => onChange((l) => ({ ...l, sash: { ...l.sash!, hinge } }))}
              options={[{ value: "left", label: "Chap" }, { value: "right", label: "O'ng" }]} />
          </div>
        )}
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">To'ldirish</span>
        <Segmented value={fill} onChange={(f: Fill) => onChange((l) => ({ ...l, fill: f }))}
          options={(Object.keys(FILL_LABEL) as Fill[]).map((f) => ({ value: f, label: FILL_LABEL[f] }))} />
        {fill === "glass" && (
          <Select value={leaf.glass ?? ""} onChange={(e) => onChange((l) => ({ ...l, glass: Number(e.target.value) || null }))}>
            <option value="">{`Asosiy oyna${defaultGlass ? ` — ${glassItems.find((g) => g.id === defaultGlass)?.name ?? ""}` : ""}`}</option>
            {glassItems.map((g) => <option key={g.id} value={g.id}>{g.name} · {Number(g.price)}</option>)}
          </Select>
        )}
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Bo'lish</span>
        <div className="flex items-center gap-2">
          <Segmented size="sm" value={String(parts) as "2" | "3" | "4"} onChange={(v) => setParts(Number(v))}
            options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
          <Button size="sm" variant="ghost" disabled={!canV} onClick={() => onSplit("v", parts)} title="Vertikal impost"><Columns2 className="size-4" strokeWidth={1.75} /> Ustunlarga</Button>
          <Button size="sm" variant="ghost" disabled={!canH} onClick={() => onSplit("h", parts)} title="Gorizontal impost"><Rows2 className="size-4" strokeWidth={1.75} /> Qatorlarga</Button>
        </div>
        {onMerge && (
          <Button size="sm" variant="quiet" className="justify-start" onClick={onMerge}><Ungroup className="size-4" strokeWidth={1.75} /> Qo'shni kataklar bilan birlashtirish</Button>
        )}
      </div>
    </fieldset>
  );
}

function SplitInspector({ design, path, disabled, onChange, onMerge }: {
  design: Design; path: Path; disabled: boolean; onChange: (d: Design | ((d: Design) => Design)) => void; onMerge: () => void;
}) {
  const s = cellAt(design.root, path);
  if (!isSplit(s)) return null;
  const span = spanOf(design, path);
  const total = s.split === "v" ? span.w : span.h;
  return (
    <fieldset disabled={disabled} className="grid gap-3">
      <p className="text-xs text-muted">{s.split === "v" ? "Ustunlar eni" : "Qatorlar bo'yi"} — impost markazigacha. Jami {Math.round(total)} mm; bittasini o'zgartirsangiz, qo'shnisi moslashadi.</p>
      <div className="grid gap-2">
        {s.sizes.map((size, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 text-sm text-muted">{s.split === "v" ? "Ustun" : "Qator"} {i + 1}</span>
            <MmInput value={size} min={MIN_CELL} max={total - MIN_CELL} disabled={disabled} onCommit={(v) => onChange((d) => resizePart(d, path, i, v))} />
            <span className="text-xs text-muted">mm</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => onChange((d) => updateCell(d, path, (c) => ({ ...(c as typeof s), sizes: s.sizes.map((_, i, a) => (i === a.length - 1 ? total - Math.round(total / a.length) * (a.length - 1) : Math.round(total / a.length))) })))}>
          Teng bo'lish
        </Button>
        <Button size="sm" variant="quiet" onClick={onMerge}><Ungroup className="size-4" strokeWidth={1.75} /> Impostlarni olib tashlash</Button>
      </div>
    </fieldset>
  );
}

/** Tiny pictograms of the opening types (same convention as the drawing). */
function SashIcon({ type }: { type: SashType | "fixed" }) {
  const common = "fill-none stroke-current";
  if (type === "door") return <DoorOpen className="size-6" strokeWidth={1.5} />;
  return (
    <svg viewBox="0 0 24 24" className="size-6">
      <rect x={4} y={3} width={16} height={18} rx={1} className={common} strokeWidth={1.5} />
      {(type === "turn" || type === "tilt_turn") && <path d="M20 3 L4 12 L20 21" className={common} strokeWidth={1.2} />}
      {(type === "tilt" || type === "tilt_turn") && <path d="M4 3 L12 21 L20 3" className={common} strokeWidth={1.2} strokeDasharray={type === "tilt" ? "2 1.5" : undefined} />}
      {type === "fixed" && <path d="M8 8h8M8 12h8M8 16h8" className="stroke-current opacity-30" strokeWidth={1} />}
    </svg>
  );
}

