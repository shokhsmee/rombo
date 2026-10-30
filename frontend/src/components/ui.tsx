// The UI kit — same shapes as uzbridge's components/ui.tsx: one radius, one edge, tokens only.
import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

// ------------------------------------------------------------------ buttons

type Variant = "primary" | "ghost" | "soft" | "danger" | "quiet";
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; size?: "md" | "sm" };

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-ink shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]",
  ghost: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-ground",
  soft: "bg-accent-soft text-accent-ink hover:bg-accent/15",
  danger: "bg-surface text-bad border border-line hover:border-bad hover:bg-bad-soft",
  quiet: "text-muted hover:bg-sunk hover:text-ink",
};

export function Button({ variant = "primary", busy, size = "md", type = "button", className = "", children, disabled, ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={`press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-50 ${size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm"} ${VARIANT[variant]} ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function IconButton({ label, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" title={label} aria-label={label}
      className={`press grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-ink disabled:opacity-40 ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return <span className={`${className} animate-spin rounded-full border-2 border-current border-r-transparent`} aria-hidden />;
}

// ------------------------------------------------------------------ inputs

const control = (error?: string) =>
  `rounded-lg border bg-surface text-sm text-ink placeholder:text-faint hover:border-line-strong focus:outline-none focus:ring-2 ${
    error ? "border-bad focus:border-bad focus:ring-bad/15" : "border-line focus:border-accent focus:ring-accent/15"
  }`;

/** `w-full` unless the caller sets its own width. */
const fill = (className: string) => (/(^|\s)w-/.test(className) ? "" : "w-full");

export function Field({ label, hint, error, required, children, className = "" }: {
  label: string; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <label className={`grid min-w-0 content-start gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-ink">{label}{required && <span className="text-bad"> *</span>}</span>
      {children}
      {error ? <span className="text-xs font-medium text-bad">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = "", error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input className={`h-9 px-3 ${fill(className)} ${control(error)} ${className}`} aria-invalid={!!error} {...rest} />;
}

export function Textarea({ className = "", error, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return <textarea rows={3} className={`px-3 py-2 ${fill(className)} ${control(error)} ${className}`} aria-invalid={!!error} {...rest} />;
}

export function Select({ className = "", error, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select className={`h-9 px-2.5 ${fill(className)} ${control(error)} ${className}`} aria-invalid={!!error} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`inline-flex select-none items-center gap-2.5 text-sm ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-line-strong"}`}>
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${checked ? "left-4.5" : "left-0.5"}`} />
      </span>
      {label}
    </label>
  );
}

export function Checkbox({ checked, onChange, label, indeterminate, disabled }: {
  checked: boolean; onChange?: (v: boolean) => void; label?: string; indeterminate?: boolean; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" aria-label={label} checked={checked} disabled={disabled || !onChange}
      onChange={(e) => onChange?.(e.target.checked)}
      className="size-4 cursor-pointer rounded accent-accent disabled:cursor-default" />
  );
}

/** Pill-shaped choice row: "Barchasi | Faol | Nofaol". Active = ink fill, like uzbridge filters. */
export function Segmented<T extends string>({ value, onChange, options, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "md" | "sm";
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-md ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5"} ${value === o.value ? "bg-ink text-on-ink" : "text-muted hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ display

const PILL = {
  neutral: "bg-sunk text-muted",
  accent: "bg-accent-soft text-accent-ink",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  done: "bg-done-soft text-done",
} as const;
export type Tone = keyof typeof PILL;

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${PILL[tone]}`}>{children}</span>;
}

export function Kpi({ label, value, sub, tone = "", onClick }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={`rounded-xl border border-line bg-surface p-3.5 text-left ${onClick ? "press cursor-pointer hover:border-accent" : ""}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular ${tone}`}>{value ?? "—"}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Tag>
  );
}

/** Odoo "smart button": a number + label on the record, opening related records. */
export function Smart({ icon, value, label, onClick }: { icon: ReactNode; value: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="press inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left hover:border-accent">
      <span className="text-accent-ink">{icon}</span>
      <span className="grid leading-tight">
        <b className="text-sm font-semibold tabular">{value}</b>
        <span className="text-2xs text-muted">{label}</span>
      </span>
    </button>
  );
}

export function ErrorNote({ error }: { error?: string | null }) {
  if (!error) return null;
  return <p className="rounded-lg border border-bad/20 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">{error}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">{children}</p>;
}

// ------------------------------------------------------------------ dialog & menu

export function Dialog({ open, onClose, title, children, footer, width = "max-w-md" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="anim-fade fixed inset-0 z-50 grid place-items-center bg-scrim/35 p-4" onMouseDown={onClose}>
      {/* tall content scrolls inside; header and footer (the buttons) always stay on screen */}
      <div role="dialog" aria-modal aria-label={title} className={`pop anim-pop flex max-h-[90dvh] w-full flex-col ${width}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="t-h2">{title}</h2>
          <IconButton label="Yopish" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
        <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-ground/50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, text, confirmLabel = "Tasdiqlash", danger, busy }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button variant={danger ? "danger" : "primary"} busy={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <p className="text-sm text-muted">{text}</p>
    </Dialog>
  );
}

/** A small dropdown: closes on outside click, Escape, or picking an item. */
export function Menu({ trigger, items, align = "left" }: {
  trigger: (open: boolean) => ReactNode;
  items: { label: ReactNode; onClick: () => void; danger?: boolean; icon?: ReactNode }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); window.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger(open)}</div>
      {open && (
        <div className={`pop anim-pop absolute z-40 mt-1 min-w-48 overflow-hidden py-1 ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"}`}>
          {items.map((it, i) => (
            <button key={i} type="button" onClick={() => { setOpen(false); it.onClick(); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ground ${it.danger ? "text-bad" : "text-ink"}`}>
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
