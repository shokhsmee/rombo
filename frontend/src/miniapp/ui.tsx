import dayjs from "dayjs";
import { Camera, CircleAlert, Loader2, Star, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import type { ApiError, Photo, Status } from "./api";
import { haptic, tg, useMainButton } from "./tg";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function fmtDate(d: string | null | undefined, withTime = true) {
  if (!d) return "";
  return dayjs(d).format(withTime ? "DD.MM.YYYY HH:mm" : "DD.MM.YYYY");
}

export function prettyPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("998"))
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  return p;
}

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto min-h-screen max-w-xl px-4 pb-28 pt-4", className)}>{children}</div>;
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string;
  onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx("rounded-2xl bg-card p-4", onClick && "cursor-pointer active:opacity-80 transition-opacity", className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 mt-5 px-1 text-xs font-medium uppercase tracking-wide text-head">{children}</div>;
}

const STATUS_TONE: Record<Status, string> = {
  new: "text-info bg-info/12",
  assigned: "text-warn bg-warn/14",
  accepted: "text-warn bg-warn/14",
  in_progress: "text-done bg-done/12",
  done: "text-ok bg-ok/12",
  closed: "text-hint bg-soft",
  cancelled: "text-danger bg-danger/10",
};

export function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
      STATUS_TONE[status])}>
      {label}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("animate-spin text-hint", className)} size={22} strokeWidth={1.75} />;
}

export function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function ErrorView({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const notLinked = error.status === 403 || error.status === 401;
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <CircleAlert size={40} strokeWidth={1.5} className="text-hint" />
      <div className="text-base font-medium">{notLinked ? "Kirish uchun ruxsat yo'q" : "Xatolik"}</div>
      <div className="text-sm text-hint">{error.message}</div>
      {notLinked && tg?.initData ? (
        <Button variant="soft" onClick={() => tg?.close()}>Botga qaytish</Button>
      ) : onRetry ? (
        <Button variant="soft" onClick={onRetry}>Qayta urinish</Button>
      ) : null}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="text-hint">{icon}</div>
      <div className="font-medium">{title}</div>
      {hint && <div className="max-w-xs text-sm text-hint">{hint}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", disabled, className, type = "button" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "soft" | "danger" | "ghost";
  disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const styles = {
    primary: "bg-accent text-on-accent",
    soft: "bg-accent-soft text-link",
    danger: "bg-danger/10 text-danger",
    ghost: "text-link",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        haptic.tap();
        onClick?.();
      }}
      className={cx("inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium",
        "transition-[opacity,transform] active:scale-[0.98] disabled:opacity-50", styles, className)}
    >
      {children}
    </button>
  );
}

/** Telegram's MainButton inside Telegram; a sticky in-page button in a browser. */
export function MainAction({ text, onClick, disabled, busy, visible = true }: { text: string;
  onClick: () => void; disabled?: boolean; busy?: boolean; visible?: boolean }) {
  const native = useMainButton({ text, onClick, disabled: disabled || busy, busy, visible });
  if (native || !visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 bg-ground/90 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className="mx-auto max-w-xl">
        <Button className="w-full" onClick={onClick} disabled={disabled || busy}>
          {busy && <Loader2 className="animate-spin" size={18} />} {text}
        </Button>
      </div>
    </div>
  );
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 px-1 text-xs font-medium text-head">{label}</div>
      {children}
      {error && <div className="mt-1 px-1 text-xs text-danger">{error}</div>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl bg-card px-3.5 py-3 text-ink outline-none ring-1 ring-line placeholder:text-hint focus:ring-2 focus:ring-accent";

export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (n: number) => void;
  size?: number }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          aria-label={`${n} yulduz`}
          onClick={() => {
            haptic.select();
            onChange?.(n);
          }}
          className="transition-transform active:scale-90 disabled:cursor-default"
        >
          <Star size={size} strokeWidth={1.5}
            className={n <= value ? "fill-star text-star" : "text-hint/50"} />
        </button>
      ))}
    </div>
  );
}

export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => setOpen(p.url)}
            className="aspect-square overflow-hidden rounded-xl bg-soft">
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <img src={open} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button type="button" aria-label="Yopish" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white">
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

/** Pick up to `max` photos from camera or gallery, with previews. */
export function PhotoPicker({ files, onChange, max = 6 }: { files: File[]; onChange: (f: File[]) => void;
  max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <div className="grid grid-cols-3 gap-2">
      {urls.map((u, i) => (
        <div key={u} className="relative aspect-square overflow-hidden rounded-xl bg-soft">
          <img src={u} alt="" className="h-full w-full object-cover" />
          <button type="button" aria-label="Olib tashlash"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white">
            <X size={14} />
          </button>
        </div>
      ))}
      {files.length < max && (
        <button type="button" onClick={() => input.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-card text-hint active:opacity-70">
          <Camera size={24} strokeWidth={1.5} />
          <span className="text-xs">Rasm</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onChange([...files, ...picked].slice(0, max));
          e.target.value = "";
        }} />
    </div>
  );
}

export function Row({ icon, children, href, onClick }: { icon: ReactNode; children: ReactNode; href?: string;
  onClick?: () => void }) {
  const body = (
    <>
      <span className="mt-0.5 shrink-0 text-hint">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </>
  );
  const cls = "flex items-start gap-3 py-2.5 text-[15px]";
  if (href) return <a href={href} className={cx(cls, "text-link")}>{body}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={cx(cls, "w-full text-left text-link")}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function Timeline({ steps }: { steps: { status: Status; label: string; at: string }[] }) {
  return (
    <ol className="relative ml-1.5 border-l border-line pl-5">
      {steps.map((s, i) => (
        <li key={s.status} className="relative pb-3 last:pb-0">
          <span className={cx("absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-card",
            i === steps.length - 1 ? "bg-accent" : "bg-hint/60")} />
          <div className="text-sm font-medium">{s.label}</div>
          <div className="text-xs text-hint">{fmtDate(s.at)}</div>
        </li>
      ))}
    </ol>
  );
}
