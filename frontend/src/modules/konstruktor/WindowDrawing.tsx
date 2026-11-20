// The construction as the workshop draws it: profile colour, glass openings, sashes with opening marks
// (the triangle points at the hinge side), sizes along the edges. Coordinates are millimetres.
import type { EngineCell } from "./api";
import { layout, pathKey, type Design, type LeafBox, type Path, type Sash, type SplitCell } from "./design";

export type Widths = { frame: number; mullion: number; sash: number; overlap: number };
export const DEFAULT_WIDTHS: Widths = { frame: 60, mullion: 80, sash: 76, overlap: 8 };

type Props = {
  design: Design;
  widths?: Widths;
  selected?: string | null; // pathKey of a leaf or split
  errorPath?: string | null;
  cells?: EngineCell[]; // engine output: glass sizes to print in the cells
  onSelect?: (path: Path, kind: "leaf" | "split") => void;
  compact?: boolean; // thumbnail: no dimensions, no labels
  className?: string;
};

export function WindowDrawing({ design, widths = DEFAULT_WIDTHS, selected, errorPath, cells, onSelect, compact, className = "" }: Props) {
  const { leaves, imposts, splits } = layout(design);
  const { w, h } = design;
  const big = Math.max(w, h);
  const font = Math.max(big / 30, 34);
  const pad = compact ? big * 0.03 : font * 4.2;
  const vSplits = splits.filter((s) => s.cell.split === "v");
  const hSplits = splits.filter((s) => s.cell.split === "h");
  const padBottom = compact ? pad : font * (2.6 + 1.6 * depthLevels(vSplits));
  const padRight = compact ? pad : font * (2.6 + 1.9 * depthLevels(hSplits));
  const vb = `${-pad} ${-pad} ${w + pad + padRight} ${h + pad + padBottom}`;
  const engineCell = (n: number) => cells?.find((c) => c.n === n);

  return (
    <svg viewBox={vb} className={`select-none ${className}`} role="img" aria-label={`Konstruksiya ${w} × ${h} mm`}>
      <defs>
        <pattern id="lambri" width={60} height={60} patternUnits="userSpaceOnUse">
          <line x1={0} y1={0} x2={60} y2={0} className="stroke-line-strong" strokeWidth={6} />
        </pattern>
        <pattern id="offcut" width={40} height={40} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={40} className="stroke-line-strong" strokeWidth={8} />
        </pattern>
      </defs>

      {/* the profile: everything that is not an opening */}
      <rect x={0} y={0} width={w} height={h} rx={big * 0.004} className="fill-surface stroke-ink" strokeWidth={big * 0.004} />
      <rect x={widths.frame} y={widths.frame} width={w - 2 * widths.frame} height={h - 2 * widths.frame}
        className="fill-none stroke-line-strong" strokeWidth={big * 0.002} />

      {leaves.map((leaf) => (
        <LeafShape key={pathKey(leaf.path)} leaf={leaf} design={design} widths={widths} font={font} compact={compact}
          selected={selected === pathKey(leaf.path)} error={errorPath === pathKey(leaf.path)}
          engine={engineCell(leaf.n)} onSelect={onSelect} />
      ))}

      {imposts.map((m, i) => {
        const key = pathKey(m.path);
        const sel = selected === key;
        const thick = Math.max(widths.mullion, big * 0.02);
        return (
          <rect key={i}
            x={m.dir === "v" ? m.x1 - thick / 2 : m.x1 + (m.x1 === 0 ? widths.frame : widths.mullion / 2)}
            y={m.dir === "h" ? m.y1 - thick / 2 : m.y1 + (m.y1 === 0 ? widths.frame : widths.mullion / 2)}
            width={m.dir === "v" ? thick : Math.max(m.x2 - m.x1 - (m.x1 === 0 ? widths.frame : widths.mullion / 2) - (m.x2 === w ? widths.frame : widths.mullion / 2), 1)}
            height={m.dir === "h" ? thick : Math.max(m.y2 - m.y1 - (m.y1 === 0 ? widths.frame : widths.mullion / 2) - (m.y2 === h ? widths.frame : widths.mullion / 2), 1)}
            className={`${onSelect ? "cursor-pointer" : ""} ${sel ? "fill-accent" : "fill-transparent hover:fill-accent/40"}`}
            onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(m.path, "split"); } : undefined}>
            <title>Impost — bosib qismlar o'lchamini o'zgartiring</title>
          </rect>
        );
      })}

      {!compact && (
        <g className="fill-muted stroke-muted" style={{ fontSize: font }}>
          <DimH x1={0} x2={w} y={h + font * 1.4 + font * 1.6 * depthLevels(vSplits)} label={w} font={font} strong />
          <DimV y1={0} y2={h} x={w + font * 1.6 + font * 1.9 * depthLevels(hSplits)} label={h} font={font} strong />
          {vSplits.map((s, i) => <SplitDims key={`v${i}`} s={s} level={levelOf(s, vSplits)} h={h} w={w} font={font} />)}
          {hSplits.map((s, i) => <SplitDims key={`h${i}`} s={s} level={levelOf(s, hSplits)} h={h} w={w} font={font} />)}
        </g>
      )}
    </svg>
  );
}

type SplitBox = { path: Path; x: number; y: number; w: number; h: number; cell: SplitCell };

const depthLevels = (s: SplitBox[]) => (s.length ? Math.max(...s.map((x) => levelOf(x, s))) + 1 : 0);
/** Nested splits of the same direction get their own dimension row. */
const levelOf = (s: SplitBox, all: SplitBox[]) => all.filter((o) => o !== s && s.path.length > o.path.length && pathKey(s.path).startsWith(pathKey(o.path))).length;

function SplitDims({ s, level, w, h, font }: { s: SplitBox; level: number; w: number; h: number; font: number }) {
  let pos = 0;
  return (
    <>
      {s.cell.sizes.map((size, i) => {
        const a = pos;
        pos += size;
        return s.cell.split === "v"
          ? <DimH key={i} x1={s.x + a} x2={s.x + a + size} y={h + font * 1.4 + font * 1.6 * level} label={size} font={font} />
          : <DimV key={i} y1={s.y + a} y2={s.y + a + size} x={w + font * 1.6 + font * 1.9 * level} label={size} font={font} />;
      })}
    </>
  );
}

function DimH({ x1, x2, y, label, font, strong }: { x1: number; x2: number; y: number; label: number; font: number; strong?: boolean }) {
  const t = font * 0.25;
  return (
    <g strokeWidth={font * 0.05}>
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - t} x2={x1} y2={y + t} />
      <line x1={x2} y1={y - t} x2={x2} y2={y + t} />
      <text x={(x1 + x2) / 2} y={y - font * 0.3} textAnchor="middle" stroke="none"
        className={strong ? "fill-ink font-semibold" : ""}>{Math.round(label)}</text>
    </g>
  );
}

function DimV({ y1, y2, x, label, font, strong }: { y1: number; y2: number; x: number; label: number; font: number; strong?: boolean }) {
  const t = font * 0.25;
  const cy = (y1 + y2) / 2;
  return (
    <g strokeWidth={font * 0.05}>
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - t} y1={y1} x2={x + t} y2={y1} />
      <line x1={x - t} y1={y2} x2={x + t} y2={y2} />
      <text x={x + font * 0.35} y={cy} dominantBaseline="middle" stroke="none" transform={`rotate(90 ${x + font * 0.35} ${cy})`}
        textAnchor="middle" className={strong ? "fill-ink font-semibold" : ""}>{Math.round(label)}</text>
    </g>
  );
}

function LeafShape({ leaf, design, widths, font, compact, selected, error, engine, onSelect }: {
  leaf: LeafBox; design: Design; widths: Widths; font: number; compact?: boolean; selected: boolean; error: boolean;
  engine?: EngineCell; onSelect?: Props["onSelect"];
}) {
  const inset = (outer: boolean) => (outer ? widths.frame : widths.mullion / 2);
  const l = inset(leaf.x === 0), t = inset(leaf.y === 0);
  const r = inset(Math.abs(leaf.x + leaf.w - design.w) < 0.5), b = inset(Math.abs(leaf.y + leaf.h - design.h) < 0.5);
  // light opening of the frame / imposts around the cell
  const ox = leaf.x + l, oy = leaf.y + t, ow = Math.max(leaf.w - l - r, 1), oh = Math.max(leaf.h - t - b, 1);
  const sash = leaf.cell.sash;
  const so = sash ? widths.overlap : 0;
  const sx = ox - so, sy = oy - so, sw = ow + 2 * so, sh = oh + 2 * so; // sash outer
  const sb = sash ? Math.min(widths.sash, sw / 3, sh / 3) : 0;
  const gx = sx + sb, gy = sy + sb, gw = Math.max(sw - 2 * sb, 1), gh = Math.max(sh - 2 * sb, 1); // filling
  const fill = leaf.cell.fill ?? "glass";
  const stroke = Math.max(design.w, design.h) * 0.0025;
  const fillClass = fill === "glass" ? "fill-info-soft" : fill === "panel" ? "fill-sunk" : "fill-[url(#lambri)]";

  return (
    <g className={onSelect ? "cursor-pointer" : ""} onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(leaf.path, "leaf"); } : undefined}>
      <rect x={ox} y={oy} width={ow} height={oh} className="fill-ground" />
      {sash && <rect x={sx} y={sy} width={sw} height={sh} className="fill-surface stroke-ink" strokeWidth={stroke} />}
      <rect x={gx} y={gy} width={gw} height={gh} className={`${fillClass} stroke-line-strong`} strokeWidth={stroke * 0.6} />
      {fill === "lambri" && <rect x={gx} y={gy} width={gw} height={gh} className="fill-sunk/40" />}
      {fill === "glass" && !compact && (
        <line x1={gx + gw * 0.62} y1={gy + gh * 0.12} x2={gx + gw * 0.82} y2={gy + gh * 0.32} className="stroke-surface" strokeWidth={stroke * 2} strokeLinecap="round" />
      )}
      {sash && <OpeningMarks sash={sash} x={gx} y={gy} w={gw} h={gh} stroke={stroke} />}
      {sash && <Handle sash={sash} x={sx} y={sy} w={sw} h={sh} sb={sb} />}
      {(selected || error) && (
        <rect x={leaf.x + l / 2} y={leaf.y + t / 2} width={leaf.w - (l + r) / 2} height={leaf.h - (t + b) / 2}
          className={`fill-none ${error ? "stroke-bad" : "stroke-accent"}`} strokeWidth={stroke * 3} strokeDasharray={error ? `${stroke * 6} ${stroke * 4}` : undefined} />
      )}
      {!compact && (
        <g style={{ fontSize: font * 0.78 }}>
          <circle cx={gx + font * 0.9} cy={gy + font * 0.9} r={font * 0.62} className={selected ? "fill-accent" : "fill-ink/70"} />
          <text x={gx + font * 0.9} y={gy + font * 0.9} textAnchor="middle" dominantBaseline="central" className="fill-on-ink font-semibold">{leaf.n}</text>
          {engine?.glass && gw > font * 5 && gh > font * 2.4 && (
            <text x={gx + gw / 2} y={gy + gh - font * 0.7} textAnchor="middle" className="fill-muted">
              {Math.round(engine.glass[0])} × {Math.round(engine.glass[1])}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

/** Lines meet at the hinge side (European convention): turn → side, tilt → bottom (or top for top-hung). */
function OpeningMarks({ sash, x, y, w, h, stroke }: { sash: Sash; x: number; y: number; w: number; h: number; stroke: number }) {
  const lines: [number, number, number, number][] = [];
  const turn = sash.type === "turn" || sash.type === "tilt_turn" || sash.type === "door";
  const tilt = sash.type === "tilt" || sash.type === "tilt_turn";
  if (turn) {
    const hingeLeft = sash.hinge !== "right";
    const apexX = hingeLeft ? x : x + w, farX = hingeLeft ? x + w : x;
    lines.push([farX, y, apexX, y + h / 2], [farX, y + h, apexX, y + h / 2]);
  }
  if (tilt) {
    const top = sash.type === "tilt" && sash.hinge === "top";
    const apexY = top ? y : y + h, farY = top ? y + h : y;
    lines.push([x, farY, x + w / 2, apexY], [x + w, farY, x + w / 2, apexY]);
  }
  return (
    <g className="stroke-ink/60" strokeWidth={stroke} strokeDasharray={sash.type === "tilt_turn" ? undefined : `${stroke * 5} ${stroke * 3}`}>
      {lines.map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} />)}
    </g>
  );
}

function Handle({ sash, x, y, w, h, sb }: { sash: Sash; x: number; y: number; w: number; h: number; sb: number }) {
  if (sash.type === "tilt") {
    const top = sash.hinge === "top";
    return <rect x={x + w / 2 - sb * 0.8} y={top ? y + h - sb * 0.7 : y + sb * 0.2} width={sb * 1.6} height={sb * 0.5} rx={sb * 0.2} className="fill-ink/70" />;
  }
  const left = sash.hinge === "right"; // the handle sits opposite the hinges
  const hx = left ? x + sb * 0.25 : x + w - sb * 0.75;
  return <rect x={hx} y={y + h / 2 - sb * 1.2} width={sb * 0.5} height={sb * 2.4} rx={sb * 0.2} className="fill-ink/70" />;
}

