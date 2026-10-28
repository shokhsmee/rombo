import { Printer, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A paper page for browser printing (→ PDF). Always light, A4, no app chrome.
 * The toolbar hides itself in print.
 */
export function PrintFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#e9ecef] py-6 print:bg-white print:py-0" data-theme="light" style={{ colorScheme: "light" }}>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print { html, body { background: #fff !important; } }
        .paper { color: #111; font-family: "Times New Roman", Georgia, serif; }
        .paper table { border-collapse: collapse; width: 100%; }
        .paper .grid-table td, .paper .grid-table th { border: 1px solid #222; padding: 2px 6px; }
      `}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-2 print:hidden">
        <span className="font-sans text-sm font-medium text-[#333]">{title}</span>
        <div className="flex gap-2 font-sans">
          <button type="button" onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1d5fb0] px-3.5 text-sm font-medium text-white hover:bg-[#164a8a]">
            <Printer className="size-4" /> Chop etish / PDF
          </button>
          <button type="button" onClick={() => window.close()}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#ccc] bg-white px-3 text-sm text-[#333]">
            <X className="size-4" /> Yopish
          </button>
        </div>
      </div>
      <div className="paper mx-auto max-w-[210mm] bg-white p-[12mm] shadow-[0_2px_16px_rgba(0,0,0,0.12)] print:max-w-none print:p-0 print:shadow-none">
        {children}
      </div>
    </div>
  );
}

/** The Rombo mark as printed on the company's documents. */
export function RomboMark({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect x="1" y="1" width="13" height="13" rx="3" fill="#222" />
        <rect x="18" y="1" width="13" height="13" rx="3" fill="#222" />
        <rect x="1" y="18" width="13" height="13" rx="3" fill="#222" />
        <path d="M18 18h9l4 13h-9z" fill="#222" />
      </svg>
      <span className="leading-none">
        <b className="block font-sans text-[22px] tracking-tight">Rombo</b>
        <span className="font-sans text-[9px]">фабрика сборки окон и дверей</span>
      </span>
    </span>
  );
}

/** 28800000 → "28 800 000" */
export const n0 = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : Math.round(Number(v)).toLocaleString("ru-RU").replace(/ /g, " ");

export const d = (iso?: string | null) => (iso ? iso.split("-").reverse().join(".") : "");
