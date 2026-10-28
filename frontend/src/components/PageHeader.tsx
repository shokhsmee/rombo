import type { ReactNode } from "react";

export function PageHeader({ title, lede, action }: { title: ReactNode; lede?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="t-title">{title}</h1>
        {lede && <p className="mt-1 max-w-2xl text-muted">{lede}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}
