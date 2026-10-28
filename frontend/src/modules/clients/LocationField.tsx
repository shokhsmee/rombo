import { ExternalLink, X } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

import { IconButton, Input, Spinner } from "@/components/ui";

import { fmtPoint, isShortLink, mapsUrl, parsePoint, type Point } from "./geo";

const PinPicker = lazy(() => import("./leaflet").then((m) => ({ default: m.PinPicker })));

/**
 * The client's point: click / drag on the small map, or paste "lat, lng" or a Google / Yandex / OSM link.
 * The text box shows the point as it is saved; anything unreadable stays in the box with a hint.
 */
export function LocationField({ value, onChange, disabled, error }: {
  value: Point | null;
  onChange: (p: Point | null) => void;
  disabled?: boolean;
  error?: string;
}) {
  const [text, setText] = useState(value ? fmtPoint(value) : "");
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => { setText(value ? fmtPoint(value) : ""); setHint(null); }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (raw: string) => {
    if (!raw.trim()) {
      if (value) onChange(null);
      setHint(null);
      return;
    }
    const p = parsePoint(raw);
    if (p) {
      onChange(p);
      setHint(null);
    } else {
      setHint(isShortLink(raw)
        ? "Qisqa havola ochilmaydi — uni brauzerda oching va manzil qatoridagi to'liq havolani qo'ying."
        : "Tushunilmadi. \"39.6542, 66.9597\" yoki Google / Yandex xarita havolasini qo'ying.");
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1.5">
        <Input value={text} disabled={disabled} error={hint ?? error} placeholder="Kenglik, uzunlik yoki xarita havolasi"
          onChange={(e) => { setText(e.target.value); setHint(null); }}
          onPaste={(e) => { const t = e.clipboardData.getData("text"); e.preventDefault(); setText(t); apply(t); }}
          onBlur={() => apply(text)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(text); } }} />
        {value && !disabled && (
          <IconButton label="Lokatsiyani olib tashlash" onClick={() => onChange(null)}><X className="size-4" strokeWidth={1.75} /></IconButton>
        )}
      </div>
      {hint && <span className="text-xs font-medium text-bad">{hint}</span>}
      <Suspense fallback={<div className="grid h-56 place-items-center rounded-lg border border-line bg-sunk text-muted"><Spinner /></div>}>
        <PinPicker value={value} onChange={onChange} disabled={disabled} />
      </Suspense>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{disabled ? "" : "Xaritani bosing yoki pinni suring."}</span>
        {value && (
          <a href={mapsUrl(value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
            Xaritada ochish <ExternalLink className="size-3.5" strokeWidth={1.75} />
          </a>
        )}
      </div>
    </div>
  );
}
