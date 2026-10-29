import { Home, Maximize2, MapPinOff } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Toolbar } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Button, Checkbox, Segmented, Spinner } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { RefSelect } from "@/modules/references/RefSelect";
import { useRefs } from "@/modules/references/api";

import { KIND_LABEL, type ClientKind } from "./api";
import { useClientMap, type ClientPin } from "./geo";
import type { Bounds } from "./leaflet";

const ClientsMap = lazy(() => import("./leaflet"));

const KIND_TONE: Record<ClientKind, string> = { individual: "bg-accent", company: "bg-done", dealer: "bg-warn", supplier: "bg-lapis" };
const SEGMENT_TONES = ["bg-ok", "bg-info", "bg-done", "bg-warn", "bg-bad", "bg-lapis"];
const NO_SEGMENT = "bg-faint";

type ColorBy = "kind" | "segment";

export function ClientMapPage() {
  const navigate = useNavigate();
  const { params, update } = useListParams();
  const f = params.filters;
  const query = useMemo(() => ({ q: params.q, kind: f.kind, segment: f.segment, manager: f.manager }), [params.q, f.kind, f.segment, f.manager]);
  const data = useClientMap(query);
  const pins = useMemo(() => data.data?.items ?? [], [data.data]);

  const [colorBy, setColorBy] = useState<ColorBy>("kind");
  const segments = useRefs("client_segment");
  const segTone = useMemo(() => new Map((segments.data ?? []).map((s, i) => [s.id, SEGMENT_TONES[i % SEGMENT_TONES.length]])), [segments.data]);
  const toneOf = useCallback(
    (p: ClientPin) => (colorBy === "kind" ? KIND_TONE[p.kind] : p.segment ? segTone.get(p.segment.id) ?? NO_SEGMENT : NO_SEGMENT),
    [colorBy, segTone],
  );
  const legend = colorBy === "kind"
    ? (Object.keys(KIND_LABEL) as ClientKind[]).map((k) => ({ tone: KIND_TONE[k], label: KIND_LABEL[k] }))
    : [...(segments.data ?? []).map((s) => ({ tone: segTone.get(s.id)!, label: s.name })), { tone: NO_SEGMENT, label: "Segmentsiz" }];

  const [selected, setSelected] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ id: number; n: number } | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [onlyVisible, setOnlyVisible] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [homeKey, setHomeKey] = useState(0);
  const [tab, setTab] = useState<"map" | "list">("map"); // phones show one at a time

  const inView = (p: ClientPin) =>
    !bounds || (p.lat >= bounds.south && p.lat <= bounds.north && p.lng >= bounds.west && p.lng <= bounds.east);
  const list = onlyVisible ? pins.filter(inView) : pins;

  const rows = useRef(new Map<number, HTMLButtonElement>());
  const pickFromMap = useCallback((id: number) => {
    setSelected(id);
    rows.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  const pickFromList = (id: number) => {
    setSelected(id);
    setFocus((x) => ({ id, n: (x?.n ?? 0) + 1 }));
    setTab("map");
  };
  useEffect(() => { if (selected && !pins.some((p) => p.id === selected)) setSelected(null); }, [pins, selected]);

  const total = data.data?.total ?? 0;
  const missing = data.data?.without_point ?? 0;

  return (
    <>
      <PageHeader title="Mijozlar xaritasi" lede="Mijozlar qayerda — tashrif, o'lchov va o'rnatishni rejalash uchun." />
      <Toolbar action={
        <Segmented size="sm" value={colorBy} onChange={setColorBy}
          options={[{ value: "kind", label: "Rang: turi" }, { value: "segment", label: "Rang: segment" }]} />
      }>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Nom, telefon, hudud…" />
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Segmented value={(f.kind as string) || ""} onChange={(k) => update({ filters: { kind: k || null } })}
            options={[{ value: "", label: "Barchasi" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))]} />
        </div>
        <RefSelect kind="client_segment" className="w-44" placeholder="Segment: barchasi"
          value={f.segment ? Number(f.segment) : null}
          onChange={(id) => update({ filters: { segment: id ? String(id) : null } })} />
        <EntitySelect endpoint="employees" placeholder="Menejer" className="w-52"
          value={f.manager ? Number(f.manager) : null}
          onChange={(id) => update({ filters: { manager: id ? String(id) : null } })} />
      </Toolbar>

      <div className="mb-2 lg:hidden">
        <Segmented value={tab} onChange={setTab} options={[{ value: "map", label: "Xarita" }, { value: "list", label: `Ro'yxat · ${list.length}` }]} />
      </div>

      <div className="grid gap-3 lg:h-[calc(100dvh-230px)] lg:min-h-[480px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className={`card flex min-h-0 flex-col overflow-hidden ${tab === "list" ? "" : "max-lg:hidden"}`}>
          <header className="grid gap-2 border-b border-line px-3 py-2.5">
            <p className="text-sm">
              <b className="tabular">{total}</b> <span className="text-muted">ta mijoz xaritada</span>
              {data.isFetching && <Spinner className="ml-2 inline-block size-3 text-muted" />}
            </p>
            {missing > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <MapPinOff className="size-3.5 shrink-0" strokeWidth={1.75} /> {missing} tasida lokatsiya yo'q — kartasida belgilang
              </p>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <Checkbox checked={onlyVisible} onChange={setOnlyVisible} label="Faqat xaritada ko'rinayotganlar" />
              Faqat xaritada ko'rinayotganlar
            </label>
          </header>
          <div className="max-h-[60vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
            {list.map((p) => (
              <button key={p.id} type="button" ref={(el) => { if (el) rows.current.set(p.id, el); else rows.current.delete(p.id); }}
                onClick={() => pickFromList(p.id)}
                className={`flex w-full items-start gap-2.5 border-b border-line px-3 py-2.5 text-left last:border-0 ${p.id === selected ? "bg-accent-soft" : "hover:bg-ground"}`}>
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${toneOf(p)}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[p.phone, p.segment?.name, p.region].filter(Boolean).join(" · ") || p.code}
                  </span>
                </span>
                {p.active_projects > 0 && (
                  <span title="Faol loyihalar" className="rounded-full bg-sunk px-1.5 py-px text-2xs font-semibold tabular text-muted">{p.active_projects}</span>
                )}
              </button>
            ))}
            {!list.length && !data.isFetching && (
              <p className="px-3 py-8 text-center text-sm text-muted">
                {onlyVisible && pins.length ? "Bu hududda mijoz yo'q — xaritani suring." : "Mijoz topilmadi."}
              </p>
            )}
          </div>
        </section>

        <section className={`relative h-[65vh] min-h-[360px] overflow-hidden rounded-xl border border-line lg:h-auto ${tab === "map" ? "" : "max-lg:hidden"}`}>
          <Suspense fallback={<div className="grid size-full place-items-center bg-sunk text-muted"><Spinner className="size-5" /></div>}>
            <ClientsMap pins={pins} toneOf={toneOf} selected={selected} focus={focus} fitKey={fitKey} homeKey={homeKey}
              onSelect={pickFromMap} onOpen={(id) => navigate(`/clients/${id}`)} onBounds={setBounds} />
          </Suspense>
          <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="pointer-events-auto shadow-[var(--shadow-card)]" onClick={() => setHomeKey((k) => k + 1)}>
              <Home className="size-3.5" strokeWidth={1.75} /> Samarqand
            </Button>
            <Button size="sm" variant="ghost" className="pointer-events-auto shadow-[var(--shadow-card)]" disabled={!pins.length} onClick={() => setFitKey((k) => k + 1)}>
              <Maximize2 className="size-3.5" strokeWidth={1.75} /> Hammasi
            </Button>
          </div>
          <ul className="absolute bottom-6 left-2 z-[500] grid max-w-[60%] gap-1 rounded-lg border border-line bg-surface/95 px-2.5 py-2 text-xs shadow-[var(--shadow-card)]">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span className={`size-2.5 shrink-0 rounded-full ${l.tone}`} aria-hidden /> <span className="truncate">{l.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="mt-2 text-xs text-muted">
        Lokatsiya mijoz kartasida belgilanadi. <Link to="/clients" className="text-accent-ink hover:underline">Mijozlar ro'yxati →</Link>
      </p>
    </>
  );
}
