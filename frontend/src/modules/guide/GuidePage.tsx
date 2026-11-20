// /guide — Qo'llanma: how each part of Rombo ERP works, chapter by chapter, with annotated screenshots.
// A chapter shows when the user may open one of its pages; the red numbered marks on a picture are named under it.
import { ArrowRight, ChevronRight, Lightbulb, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";

import { CHAPTERS } from "./chapters";
import type { GuideBlock, GuideSection, Shot } from "./types";

/** A screenshot at full size over the page (a portal, so no layer of the page clips it). Esc or a click closes. */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}
      className="fixed inset-0 z-[100] grid place-items-center bg-scrim p-4 sm:p-8">
      <img src={src} alt={alt} className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-pop" />
      <button type="button" onClick={onClose}
        className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-pop">
        Yopish <X className="size-4" strokeWidth={1.75} />
      </button>
    </div>,
    document.body,
  );
}

/** The red numbered mark, as drawn on the screenshots. */
function Mark({ n }: { n: number }) {
  return (
    <span className="inline-grid size-6 shrink-0 place-items-center rounded-full border-2 border-surface bg-brand text-xs font-bold text-white shadow-card">
      {n}
    </span>
  );
}

function ShotView({ shot, pics, onZoom }: { shot: Shot; pics: string; onZoom: (src: string, alt: string) => void }) {
  const src = `/guide/${pics}/${shot.img}.webp`;
  return (
    <figure className="grid gap-2.5">
      <button type="button" onClick={() => onZoom(src, shot.caption)} title="Kattalashtirish uchun bosing"
        className="group overflow-hidden rounded-xl border border-line bg-ground shadow-card">
        <img src={src} alt={shot.caption} loading="lazy" className="w-full transition-transform duration-200 group-hover:scale-[1.01] motion-reduce:transition-none" />
      </button>
      <figcaption className="grid gap-2 text-sm">
        <span className="text-xs font-medium text-muted">{shot.caption}</span>
        {shot.marks?.map((m, i) => (
          <span key={i} className="flex items-start gap-2.5 leading-relaxed"><Mark n={i + 1} /><span>{m}</span></span>
        ))}
      </figcaption>
    </figure>
  );
}

function BlockView({ b, n, pics, onZoom }: { b: GuideBlock; n: number; pics: string; onZoom: (src: string, alt: string) => void }) {
  return (
    <section id={`b${n}`} className="grid scroll-mt-20 gap-3 border-t border-line pt-7 first:border-0 first:pt-0">
      <h3 className="text-base font-semibold text-ink">{b.h}</h3>
      {b.text && <p className="max-w-3xl text-sm leading-relaxed text-muted">{b.text}</p>}
      {b.shot && <ShotView shot={b.shot} pics={pics} onZoom={onZoom} />}
      {b.steps && (
        <ol className="grid max-w-3xl gap-2.5">
          {b.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
      {b.points && (
        <ul className="grid max-w-3xl gap-2">
          {b.points.map((p, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" /><span>{p}</span></li>
          ))}
        </ul>
      )}
      {b.tip && (
        <div className="flex max-w-3xl gap-2.5 rounded-lg bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
          <Lightbulb className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>{b.tip}</span>
        </div>
      )}
    </section>
  );
}

export function GuidePage() {
  const { can } = useAuth();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const sections = useMemo(() => CHAPTERS.filter((s) => !s.pages || s.pages.some((p) => can(p))), [can]);
  const openId = sections.some((s) => s.id === hash.slice(1)) ? hash.slice(1) : sections[0]?.id;
  const s = sections.find((x) => x.id === openId);
  const next = s ? sections[sections.indexOf(s) + 1] : undefined;
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const go = (id: string) => {
    navigate({ hash: id }, { replace: true });
    window.scrollTo({ top: 0 });
  };
  // chapters grouped as in the sidebar: "Boshlash", "Savdo"…
  const parts = sections.reduce<{ part: string; items: GuideSection[] }[]>((acc, x) => {
    const last = acc[acc.length - 1];
    if (last?.part === x.part) last.items.push(x);
    else acc.push({ part: x.part, items: [x] });
    return acc;
  }, []);

  return (
    <>
      <PageHeader title="Qo'llanma" lede="Tizimning har bir bo'limi qanday ishlaydi — qadam-baqadam, rasmlar bilan. Rasmdagi qizil raqamlar pastda tushuntirilgan." />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Boblar" className="grid content-start gap-4 text-sm lg:sticky lg:top-20">
          {/* phone: one select instead of the long list */}
          <select aria-label="Bob" value={openId} onChange={(e) => go(e.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm lg:hidden">
            {parts.map((p) => (
              <optgroup key={p.part} label={p.part}>
                {p.items.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
              </optgroup>
            ))}
          </select>
          {parts.map((p) => (
            <div key={p.part} className="hidden gap-0.5 lg:grid">
              <p className="t-label px-3 pb-1">{p.part}</p>
              {p.items.map((x) => (
                <button key={x.id} type="button" onClick={() => go(x.id)} aria-current={x.id === openId ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-left transition-colors ${x.id === openId ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:bg-sunk hover:text-ink"}`}>
                  {x.title}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {s ? (
          <article className="card min-w-0 p-5 sm:p-7">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {s.who && <span className="mb-2 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-ink">{s.who}</span>}
                <h2 className="text-xl font-semibold text-ink">{s.title}</h2>
                <p className="mt-1.5 max-w-3xl leading-relaxed text-muted">{s.intro}</p>
              </div>
              {s.to && (
                <Link to={s.to} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                  Sahifani ochish <ArrowRight className="size-4" strokeWidth={1.75} />
                </Link>
              )}
            </header>
            {s.blocks.length > 2 && (
              <nav aria-label="Bu bobda" className="mt-5 flex flex-wrap gap-1.5 text-xs">
                <span className="self-center font-semibold uppercase tracking-wide text-muted">Bu bobda:</span>
                {s.blocks.map((b, i) => (
                  <a key={i} href={`#b${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`b${i}`)?.scrollIntoView({ behavior: "smooth" }); }}
                    className="rounded-full border border-line px-2.5 py-1 text-ink hover:border-accent hover:text-accent-ink">{b.h}</a>
                ))}
              </nav>
            )}
            <div className="mt-7 grid gap-8">
              {s.blocks.map((b, i) => <BlockView key={i} b={b} n={i} pics={s.pics} onZoom={(src, alt) => setZoom({ src, alt })} />)}
            </div>
            {s.faq && s.faq.length > 0 && (
              <div className="mt-9 grid gap-2">
                <h3 className="t-label">Ko'p beriladigan savollar</h3>
                {s.faq.map(([q, a], i) => (
                  <details key={i} className="rounded-lg border border-line px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-medium text-ink">{q}</summary>
                    <p className="mt-2 leading-relaxed text-muted">{a}</p>
                  </details>
                ))}
              </div>
            )}
            {next && (
              <button type="button" onClick={() => go(next.id)}
                className="press mt-9 flex w-full items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-left text-sm hover:border-accent">
                <span className="text-muted">Keyingi bob</span>
                <span className="flex items-center gap-1 font-semibold text-ink">{next.title} <ChevronRight className="size-4" strokeWidth={1.75} /></span>
              </button>
            )}
          </article>
        ) : (
          <p className="text-muted">Sizga ochiq bo'lim yo'q.</p>
        )}
      </div>
      {zoom && <Lightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </>
  );
}
