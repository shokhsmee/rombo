// The construction design: a frame split into cells by imposts. Same JSON the backend engine reads
// (apps/konstruktor/engine/geometry.py). Only layout lives here; every number shown to the user
// (pieces, glass sizes, price) comes from the engine.

export type Fill = "glass" | "panel" | "lambri";
export type SashType = "turn" | "tilt" | "tilt_turn" | "door";
export type Hinge = "left" | "right" | "top" | "bottom";
export type Sash = { type: SashType; hinge: Hinge };

export type Leaf = { fill?: Fill; glass?: number | null; sash?: Sash | null };
export type SplitCell = { split: "v" | "h"; sizes: number[]; cells: Cell[] };
export type Cell = Leaf | SplitCell;
export type Design = { w: number; h: number; root: Cell };

export const isSplit = (c: Cell): c is SplitCell => "split" in c && !!(c as SplitCell).split;

export const MIN_CELL = 150;

export const SASH_LABEL: Record<SashType, string> = {
  turn: "Burilma",
  tilt: "Fortochka",
  tilt_turn: "Burilma-qiyalama",
  door: "Eshik",
};
export const FILL_LABEL: Record<Fill, string> = { glass: "Oyna", panel: "Panel", lambri: "Lambri" };

/** "root.cells.1.cells.0" ↔ [1, 0] */
export type Path = number[];
export const pathKey = (p: Path) => ["root", ...p.flatMap((i) => ["cells", String(i)])].join(".");

export function cellAt(root: Cell, path: Path): Cell {
  let c = root;
  for (const i of path) c = (c as SplitCell).cells[i];
  return c;
}

function replaceAt(root: Cell, path: Path, fn: (c: Cell) => Cell): Cell {
  if (!path.length) return fn(root);
  const s = root as SplitCell;
  const [i, ...rest] = path;
  return { ...s, cells: s.cells.map((c, j) => (j === i ? replaceAt(c, rest, fn) : c)) };
}

export const updateCell = (d: Design, path: Path, fn: (c: Cell) => Cell): Design => ({ ...d, root: replaceAt(d.root, path, fn) });

/** Span of the cell at `path` (its width and height in mm). */
export function spanOf(d: Design, path: Path): { w: number; h: number } {
  let w = d.w, h = d.h, c = d.root;
  for (const i of path) {
    const s = c as SplitCell;
    if (s.split === "v") w = s.sizes[i]; else h = s.sizes[i];
    c = s.cells[i];
  }
  return { w, h };
}

/** Even parts that add up exactly to `span` (the last one takes the rounding). */
export function evenSizes(span: number, n: number): number[] {
  const part = Math.round(span / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? span - part * (n - 1) : part));
}

/** Split a leaf into n equal parts; the leaf's filling goes to every part, its sash to the first. */
export function splitCell(d: Design, path: Path, dir: "v" | "h", n: number): Design {
  const { w, h } = spanOf(d, path);
  return updateCell(d, path, (c) => {
    const leaf = c as Leaf;
    const base: Leaf = { fill: leaf.fill ?? "glass", glass: leaf.glass ?? null };
    return {
      split: dir,
      sizes: evenSizes(dir === "v" ? w : h, n),
      cells: Array.from({ length: n }, (_, i) => (i === 0 && leaf.sash ? { ...base, sash: leaf.sash } : { ...base })),
    };
  });
}

/** Undo the split that contains the cell at `path`: the parent becomes one leaf again. */
export function mergeParent(d: Design, path: Path): { design: Design; path: Path } {
  const parent = path.slice(0, -1);
  const first = cellAt(d.root, [...parent, 0]);
  const leaf: Leaf = isSplit(first) ? { fill: "glass" } : { fill: first.fill ?? "glass", glass: first.glass ?? null };
  return { design: updateCell(d, parent, () => leaf), path: parent };
}

/** Change part i of a split; the neighbour after it (or before, for the last) absorbs the difference. */
export function resizePart(d: Design, splitPath: Path, i: number, size: number): Design {
  return updateCell(d, splitPath, (c) => {
    const s = c as SplitCell;
    const sizes = [...s.sizes];
    const j = i < sizes.length - 1 ? i + 1 : i - 1;
    const total = sizes[i] + sizes[j];
    const v = Math.max(MIN_CELL, Math.min(total - MIN_CELL, Math.round(size)));
    sizes[i] = v;
    sizes[j] = total - v;
    return { ...s, sizes };
  });
}

/** Scale every split so the design fits a new outer size, keeping proportions. */
export function resizeOuter(d: Design, w: number, h: number): Design {
  const scale = (c: Cell, cw: number, ch: number): Cell => {
    if (!isSplit(c)) return c;
    const span = c.split === "v" ? cw : ch;
    const old = c.sizes.reduce((a, b) => a + b, 0) || 1;
    let sizes = c.sizes.map((s) => Math.round((s / old) * span));
    sizes[sizes.length - 1] = span - sizes.slice(0, -1).reduce((a, b) => a + b, 0);
    if (sizes.some((s) => s <= 0)) sizes = evenSizes(span, c.sizes.length);
    return { ...c, sizes, cells: c.cells.map((ch2, i) => (c.split === "v" ? scale(ch2, sizes[i], ch) : scale(ch2, cw, sizes[i]))) };
  };
  return { w, h, root: scale(d.root, w, h) };
}

/** Every leaf with its rectangle (mm from the top-left outer corner) — for drawing and hit-testing. */
export type LeafBox = { path: Path; x: number; y: number; w: number; h: number; cell: Leaf; n: number };
export type ImpostLine = { x1: number; y1: number; x2: number; y2: number; path: Path; index: number; dir: "v" | "h" };

export function layout(d: Design): { leaves: LeafBox[]; imposts: ImpostLine[]; splits: { path: Path; x: number; y: number; w: number; h: number; cell: SplitCell }[] } {
  const leaves: LeafBox[] = [];
  const imposts: ImpostLine[] = [];
  const splits: { path: Path; x: number; y: number; w: number; h: number; cell: SplitCell }[] = [];
  const walk = (c: Cell, path: Path, x: number, y: number, w: number, h: number) => {
    if (!isSplit(c)) {
      leaves.push({ path, x, y, w, h, cell: c, n: leaves.length + 1 });
      return;
    }
    splits.push({ path, x, y, w, h, cell: c });
    let pos = 0;
    c.cells.forEach((child, i) => {
      const s = c.sizes[i];
      if (c.split === "v") walk(child, [...path, i], x + pos, y, s, h);
      else walk(child, [...path, i], x, y + pos, w, s);
      pos += s;
      if (i < c.cells.length - 1) {
        imposts.push(c.split === "v"
          ? { x1: x + pos, y1: y, x2: x + pos, y2: y + h, path, index: i, dir: "v" }
          : { x1: x, y1: y + pos, x2: x + w, y2: y + pos, path, index: i, dir: "h" });
      }
    });
  };
  walk(d.root, [], 0, 0, d.w, d.h);
  return { leaves, imposts, splits };
}

// ------------------------------------------------------------------ templates

const g = (sash?: Sash): Leaf => (sash ? { fill: "glass", sash } : { fill: "glass" });
const tt = (hinge: Hinge = "left"): Sash => ({ type: "tilt_turn", hinge });

export type Template = { key: string; label: string; design: Design };

export const TEMPLATES: Template[] = [
  { key: "fixed", label: "Gluxoy", design: { w: 1000, h: 1400, root: g() } },
  { key: "single", label: "Bir tabaqa", design: { w: 700, h: 1400, root: g(tt()) } },
  { key: "two", label: "Ikki qism", design: { w: 1300, h: 1400, root: { split: "v", sizes: [650, 650], cells: [g(), g(tt())] } } },
  { key: "three", label: "Uch qism", design: { w: 2000, h: 1400, root: { split: "v", sizes: [650, 700, 650], cells: [g(tt("left")), g(), g(tt("right"))] } } },
  { key: "transom", label: "Fortochkali", design: { w: 1300, h: 1600, root: { split: "h", sizes: [400, 1200], cells: [g({ type: "tilt", hinge: "bottom" }), { split: "v", sizes: [650, 650], cells: [g(), g(tt())] }] } } },
  { key: "balcony", label: "Balkon bloki", design: { w: 2100, h: 2150, root: { split: "v", sizes: [750, 1350], cells: [
    { fill: "glass", sash: { type: "door", hinge: "left" } },
    { split: "h", sizes: [1400, 750], cells: [{ split: "v", sizes: [675, 675], cells: [g(), g(tt())] }, { fill: "panel" }] }] } } },
  { key: "door", label: "Eshik", design: { w: 900, h: 2100, root: { fill: "panel", sash: { type: "door", hinge: "left" } } } },
];

export const defaultDesign = (): Design => structuredClone(TEMPLATES[2].design);
