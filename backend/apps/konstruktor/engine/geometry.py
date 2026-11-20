"""Construction (a window / door drawn as a split tree) → pieces, glass, rubber, hardware counts.

Pure Python, no Django: the same input always gives the same output (design D1). Lengths are mm.
Formulas follow the Romchi 2.0 chain (drawing → pieces → bars) re-stated in our own terms
(`docs/reference/romchi-formulas.md`); every number the workshop may change is a `Params` field.

Design document (`schema: 1`)::

    {"w": 1200, "h": 1400,
     "root": {"split": "v", "sizes": [600, 600],          # child widths, mullion centre to centre / outer edge
              "cells": [{"fill": "glass"},
                        {"fill": "glass", "sash": {"type": "tilt_turn", "hinge": "left"}}]}}

A leaf cell has `fill` (glass | panel | lambri), optional `glass` (price-list item id) and optional `sash`.
A split cell has `split` (v | h), `sizes` that add up to the cell's span, and as many `cells`.
"""

from __future__ import annotations

from dataclasses import dataclass, field

MIN_SIZE, MAX_SIZE = 300, 6000  # outer size, mm
MIN_CELL = 150  # a cell narrower than this cannot be glazed or opened
FILLS = ("glass", "panel", "lambri")
SASH_TYPES = ("turn", "tilt", "tilt_turn", "door")
HINGES = ("left", "right", "top", "bottom")
SASH_LABEL = {"turn": "Burilma", "tilt": "Fortochka", "tilt_turn": "Burilma-qiyalama", "door": "Eshik"}


class EngineError(ValueError):
    """A design the workshop cannot make. `path` points at the cell ("root.cells.1")."""

    def __init__(self, message: str, path: str = ""):
        super().__init__(message)
        self.message, self.path = message, path


@dataclass(frozen=True)
class Params:
    """Profile-system values (mm). Defaults are a 60 mm PVC system; each system stores its own."""

    frame_width: float = 60  # what the frame takes from the opening on each outer side
    mullion_width: float = 80  # visible impost width; each neighbour cell loses half of it
    sash_width: float = 76  # what the sash takes from its own outer size on each side
    weld_allowance: float = 3  # added to a mitred piece per welded end (0 for mechanical joints)
    mullion_allowance: float = 6  # impost cut length − clear span between the profiles it joins
    sash_overlap: float = 8  # sash outer size − light opening, per side
    glass_deduction_fixed: float = 10  # light opening − glass, per dimension (both sides together)
    glass_deduction_sash: float = 10  # sash inner opening − glass, per dimension
    bead_allowance: float = 0  # bead cut length − the opening side it holds


@dataclass
class Piece:
    role: str  # frame | sash | door_sash | mullion | bead
    length: float
    label: str

    def as_dict(self) -> dict:
        return {"role": self.role, "length": _r(self.length), "label": self.label}


@dataclass
class Result:
    w: float
    h: float
    pieces: list[Piece] = field(default_factory=list)
    glass: list[dict] = field(default_factory=list)  # {cell, item, w, h, m2}
    fills: list[dict] = field(default_factory=list)  # panel / lambri: {cell, fill, w, h, m2}
    cells: list[dict] = field(default_factory=list)  # every leaf for the drawing: rect, opening, sash
    counts: dict[str, float] = field(default_factory=dict)
    lengths_m: dict[str, float] = field(default_factory=dict)

    @property
    def area_m2(self) -> float:
        return self.w * self.h / 1_000_000

    def as_dict(self) -> dict:
        return {"w": self.w, "h": self.h, "area_m2": round(self.area_m2, 4),
                "pieces": [p.as_dict() for p in self.pieces], "glass": self.glass, "fills": self.fills,
                "cells": self.cells, "counts": self.counts,
                "lengths_m": {k: round(v, 3) for k, v in self.lengths_m.items()}}


def _r(v: float) -> float:
    return round(v + 0.0, 1)


def _num(v, path: str, name: str) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise EngineError(f"{name}: son kiriting", path) from None
    if x != x or x in (float("inf"), float("-inf")):
        raise EngineError(f"{name}: son kiriting", path)
    return x


def validate(design: dict) -> tuple[float, float, dict]:
    """Checks the whole tree; returns (w, h, root). Raises EngineError with a path."""
    if not isinstance(design, dict):
        raise EngineError("Chizma noto'g'ri")
    w = _num(design.get("w"), "w", "Eni")
    h = _num(design.get("h"), "h", "Bo'yi")
    for val, path, name in ((w, "w", "Eni"), (h, "h", "Bo'yi")):
        if not MIN_SIZE <= val <= MAX_SIZE:
            raise EngineError(f"{name} {MIN_SIZE}–{MAX_SIZE} mm oralig'ida bo'lsin", path)
    root = design.get("root") or {"fill": "glass"}
    _check_cell(root, w, h, "root")
    return w, h, root


def _check_cell(cell: dict, w: float, h: float, path: str) -> None:
    if not isinstance(cell, dict):
        raise EngineError("Katak noto'g'ri", path)
    if w < MIN_CELL - 0.01 or h < MIN_CELL - 0.01:
        raise EngineError(f"Katak juda kichik ({_r(w)} × {_r(h)} mm), kamida {MIN_CELL} mm", path)
    split = cell.get("split")
    if split is None:
        if cell.get("fill", "glass") not in FILLS:
            raise EngineError("To'ldirish turi noto'g'ri", path)
        sash = cell.get("sash")
        if sash:
            if sash.get("type") not in SASH_TYPES:
                raise EngineError("Tabaqa turi noto'g'ri", path)
            if sash.get("hinge", "left") not in HINGES:
                raise EngineError("Lup tomoni noto'g'ri", path)
        return
    if split not in ("v", "h"):
        raise EngineError("Bo'lish yo'nalishi noto'g'ri", path)
    if cell.get("sash"):
        raise EngineError("Bo'lingan katakda tabaqa bo'lmaydi — tabaqani ichki katakka qo'ying", path)
    sizes, cells = cell.get("sizes") or [], cell.get("cells") or []
    if len(sizes) < 2 or len(sizes) != len(cells):
        raise EngineError("Bo'lingan katakda kamida 2 ta qism bo'lsin", path)
    span = w if split == "v" else h
    sizes = [_num(s, path, "Qism o'lchami") for s in sizes]
    if abs(sum(sizes) - span) > 0.5:
        raise EngineError(f"Qismlar yig'indisi {_r(sum(sizes))} mm, {_r(span)} mm bo'lishi kerak", path)
    for i, (s, c) in enumerate(zip(sizes, cells, strict=True)):
        cw, ch = (s, h) if split == "v" else (w, s)
        _check_cell(c, cw, ch, f"{path}.cells.{i}")


def calculate(design: dict, p: Params) -> Result:
    w, h, root = validate(design)
    res = Result(w=w, h=h)
    wd = 2 * p.weld_allowance
    res.pieces += [Piece("frame", w + wd, "Rom — yuqori"), Piece("frame", w + wd, "Rom — past"),
                   Piece("frame", h + wd, "Rom — chap"), Piece("frame", h + wd, "Rom — o'ng")]
    counts = dict.fromkeys(("constructions", "sash", "turn", "tilt", "tilt_turn", "door", "mullion",
                            "mullion_ends", "glass_units"), 0.0)
    counts["constructions"] = 1
    lengths = dict.fromkeys(("rubber_glass", "rubber_sash", "rubber_frame", "mullion"), 0.0)
    lengths["rubber_frame"] = 2 * (w + h - 4 * p.frame_width) / 1000
    res.counts, res.lengths_m = counts, lengths
    _walk(root, 0, 0, w, h, ("frame", "frame", "frame", "frame"), "root", p, res)
    res.counts["mullion_ends"] = 2 * res.counts["mullion"]
    res.counts["glass_units"] = len(res.glass)
    res.counts["area_m2"] = round(res.area_m2, 4)
    res.counts["panel_m2"] = round(sum(f["m2"] for f in res.fills if f["fill"] == "panel"), 4)
    res.counts["lambri_m2"] = round(sum(f["m2"] for f in res.fills if f["fill"] == "lambri"), 4)
    res.counts["glass_m2"] = round(sum(g["m2"] for g in res.glass), 4)
    return res


def _inset(edge: str, p: Params) -> float:
    return p.frame_width if edge == "frame" else p.mullion_width / 2


def _walk(cell, x, y, w, h, edges, path, p: Params, res: Result) -> None:
    """edges = (left, top, right, bottom), each "frame" or "mullion"."""
    left, top, right, bottom = edges
    split = cell.get("split")
    if split:
        sizes = [float(s) for s in cell["sizes"]]
        pos = 0.0
        for i, (s, child) in enumerate(zip(sizes, cell["cells"], strict=True)):
            first, last = i == 0, i == len(sizes) - 1
            if split == "v":
                child_edges = (left if first else "mullion", top, right if last else "mullion", bottom)
                _walk(child, x + pos, y, s, h, child_edges, f"{path}.cells.{i}", p, res)
            else:
                child_edges = (left, top if first else "mullion", right, bottom if last else "mullion")
                _walk(child, x, y + pos, w, s, child_edges, f"{path}.cells.{i}", p, res)
            pos += s
            if not last:  # the impost between child i and i + 1
                n = int(res.counts["mullion"]) + 1
                if split == "v":
                    clear = h - _inset(top, p) - _inset(bottom, p)
                    label = f"Impost {n} — vertikal"
                else:
                    clear = w - _inset(left, p) - _inset(right, p)
                    label = f"Impost {n} — gorizontal"
                res.pieces.append(Piece("mullion", clear + p.mullion_allowance, label))
                res.counts["mullion"] += 1
                res.lengths_m["mullion"] += clear / 1000
        return

    n = len(res.cells) + 1
    ow = w - _inset(left, p) - _inset(right, p)  # light opening of the frame / mullions around the cell
    oh = h - _inset(top, p) - _inset(bottom, p)
    if ow <= 0 or oh <= 0:
        raise EngineError(f"Katak {n}: profillar orasida joy qolmadi", path)
    fill = cell.get("fill", "glass")
    sash = cell.get("sash") or None
    info = {"n": n, "path": path, "x": _r(x), "y": _r(y), "w": _r(w), "h": _r(h),
            "opening": [_r(ow), _r(oh)], "fill": fill, "sash": sash}

    if sash:
        stype = sash["type"]
        sw, sh = ow + 2 * p.sash_overlap, oh + 2 * p.sash_overlap  # sash outer size
        iw, ih = sw - 2 * p.sash_width, sh - 2 * p.sash_width  # sash inner (glass) opening
        if iw <= 0 or ih <= 0:
            raise EngineError(f"Katak {n}: tabaqa uchun juda tor", path)
        role = "door_sash" if stype == "door" else "sash"
        what = "Eshik tabaqasi" if stype == "door" else "Tabaqa"
        wd = 2 * p.weld_allowance
        res.pieces += [Piece(role, sw + wd, f"{what} {n} — yuqori"), Piece(role, sw + wd, f"{what} {n} — past"),
                       Piece(role, sh + wd, f"{what} {n} — chap"), Piece(role, sh + wd, f"{what} {n} — o'ng")]
        res.counts["sash"] += 1
        res.counts[stype] += 1
        res.lengths_m["rubber_sash"] += 2 * (sw + sh) / 1000
        gw, gh, deduction = iw, ih, p.glass_deduction_sash
        info["sash_size"] = [_r(sw), _r(sh)]
    else:
        gw, gh, deduction = ow, oh, p.glass_deduction_fixed

    if fill == "glass":
        pw, ph = gw - deduction, gh - deduction
        if pw <= 0 or ph <= 0:
            raise EngineError(f"Katak {n}: oyna uchun joy yo'q", path)
        m2 = round(pw * ph / 1_000_000, 4)
        res.glass.append({"cell": n, "item": cell.get("glass"), "w": _r(pw), "h": _r(ph), "m2": m2})
        res.lengths_m["rubber_glass"] += 2 * (pw + ph) / 1000
        info["glass"] = [_r(pw), _r(ph)]
    else:
        m2 = round(gw * gh / 1_000_000, 4)
        res.fills.append({"cell": n, "fill": fill, "w": _r(gw), "h": _r(gh), "m2": m2})
    # beads hold the filling on all four sides of the opening it sits in
    ba = p.bead_allowance
    res.pieces += [Piece("bead", gw + ba, f"Shtapik {n} — gorizontal"), Piece("bead", gw + ba, f"Shtapik {n} — gorizontal"),
                   Piece("bead", gh + ba, f"Shtapik {n} — vertikal"), Piece("bead", gh + ba, f"Shtapik {n} — vertikal")]
    res.cells.append(info)
