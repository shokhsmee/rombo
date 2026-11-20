// What the engine made of the drawing: price lines, cut pieces, glass sizes — the numbers sales can trust.
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Segmented, Spinner } from "@/components/ui";
import { fmtMoney } from "@/lib/format";

import type { EnginePiece, Preview, Priced } from "./api";

const ROLE_LABEL: Record<string, string> = {
  frame: "Rom (L)", sash: "Tabaqa (Z)", door_sash: "Eshik tabaqasi", mullion: "Impost (T)", bead: "Shtapik",
};

export function ResultPanel({ preview, busy, currency }: { preview: Preview | null; busy: boolean; currency: string }) {
  const [tab, setTab] = useState<"price" | "pieces" | "glass">("price");
  return (
    <section className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="t-label flex items-center gap-2">Hisob {busy && <Spinner className="size-3 text-muted" />}</h2>
        <Segmented size="sm" value={tab} onChange={setTab}
          options={[{ value: "price", label: "Narx" }, { value: "pieces", label: "Detallar" }, { value: "glass", label: "Oynalar" }]} />
      </div>
      {!preview ? <p className="text-sm text-muted">Hisoblanmoqda…</p> : (
        <>
          {tab === "price" && <PriceTable data={preview} currency={currency} />}
          {tab === "pieces" && <PiecesTable pieces={preview.result.pieces} />}
          {tab === "glass" && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Katak</th><th className="font-medium">Oyna o'lchami</th><th className="text-right font-medium">m²</th></tr></thead>
              <tbody>
                {preview.result.glass.map((g) => (
                  <tr key={g.cell} className="border-t border-line"><td className="py-1.5">{g.cell}</td><td className="tabular">{Math.round(g.w)} × {Math.round(g.h)}</td><td className="text-right tabular">{g.m2.toFixed(3)}</td></tr>
                ))}
                {preview.result.fills.map((f) => (
                  <tr key={`f${f.cell}`} className="border-t border-line text-muted"><td className="py-1.5">{f.cell}</td><td className="tabular">{f.fill === "panel" ? "Panel" : "Lambri"} {Math.round(f.w)} × {Math.round(f.h)}</td><td className="text-right tabular">{f.m2.toFixed(3)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

export function PriceTable({ data, currency, compact }: { data: Priced; currency: string; compact?: boolean }) {
  const total = Number(data.totals[currency] ?? 0);
  return (
    <div className="grid gap-2">
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <tbody>
            {data.lines.map((ln) => (
              <tr key={ln.item_id} className="border-b border-line last:border-0">
                <td className="px-2.5 py-1.5">
                  <div className="font-medium leading-tight">{ln.name}</div>
                  {!compact && <div className="text-2xs text-muted">{ln.bars ? "raskroydan keyin, xlist" : ln.from.join(", ")}</div>}
                </td>
                <td className="whitespace-nowrap px-2 text-right tabular">{Number(ln.qty)} <span className="text-xs text-muted">{ln.unit}</span></td>
                <td className="whitespace-nowrap px-2.5 text-right font-semibold tabular">{fmtMoney(ln.sum)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-ground/60"><td className="px-2.5 py-2 font-semibold" colSpan={2}>Jami</td><td className="px-2.5 text-right font-bold tabular">{fmtMoney(total, currency)}</td></tr>
          </tfoot>
        </table>
      </div>
      {data.unmapped.length > 0 && (
        <div className="grid gap-1 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          <span className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" strokeWidth={1.75} /> Narx ro'yxatida bog'lanmagan</span>
          {data.unmapped.map((u, i) => <span key={i}>{u.label}: {Number(u.qty)} {u.unit}</span>)}
          <span className="text-warn/80">Profil tizimida bu vazifaga narx qatorini bog'lang.</span>
        </div>
      )}
    </div>
  );
}

function PiecesTable({ pieces }: { pieces: EnginePiece[] }) {
  // the same length in the same role is one row × n — how the workshop reads a cut list
  const rows = new Map<string, { role: string; length: number; n: number; labels: string[] }>();
  for (const p of pieces) {
    const key = `${p.role}:${p.length}`;
    const r = rows.get(key) ?? { role: p.role, length: p.length, n: 0, labels: [] };
    r.n += 1;
    r.labels.push(p.label);
    rows.set(key, r);
  }
  const sorted = [...rows.values()].sort((a, b) => Object.keys(ROLE_LABEL).indexOf(a.role) - Object.keys(ROLE_LABEL).indexOf(b.role) || b.length - a.length);
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Profil</th><th className="text-right font-medium">Uzunlik, mm</th><th className="text-right font-medium">Soni</th></tr></thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={`${r.role}${r.length}`} className="border-t border-line" title={r.labels.join("\n")}>
            <td className="py-1.5">{ROLE_LABEL[r.role] ?? r.role}</td>
            <td className="text-right font-semibold tabular">{r.length}</td>
            <td className="text-right tabular">{r.n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
