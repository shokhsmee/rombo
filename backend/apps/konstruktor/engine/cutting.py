"""Cutting pieces from stock bars (raskroy): best-fit decreasing with saw kerf and end trim.

Deterministic: the same pieces give the same plan. Each piece takes its length plus one kerf (the cut that
frees it); the last piece on a bar may take the end without a kerf when it fits exactly.
"""

from __future__ import annotations

from dataclasses import dataclass, field


class CutError(ValueError):
    def __init__(self, message: str, label: str = ""):
        super().__init__(message)
        self.message, self.label = message, label


@dataclass
class Bar:
    capacity: float
    pieces: list[dict] = field(default_factory=list)
    used: float = 0.0

    @property
    def remaining(self) -> float:
        return self.capacity - self.used


def cut(pieces: list[dict], *, bar_length: float, kerf: float = 5, trim: float = 0) -> dict:
    """pieces: [{length, label, ...}] → {bars: [{pieces, used, offcut}], count, total_length, waste_pct}."""
    if bar_length <= 0:
        raise CutError("Profil (xlist) uzunligi kiritilmagan")
    capacity = bar_length - trim
    bars: list[Bar] = []
    ordered = sorted(pieces, key=lambda x: (-x["length"], x.get("label", "")))
    for pc in ordered:
        length = float(pc["length"])
        if length > capacity + 1e-6:
            raise CutError(f"Profil xlistdan uzun: {pc.get('label', '')} {length:g} mm > {capacity:g} mm",
                           pc.get("label", ""))
        best, best_left = None, None
        for b in bars:
            need = length + kerf if b.remaining - length >= kerf else length
            if b.remaining + 1e-6 >= need:
                left = b.remaining - need
                if best is None or left < best_left - 1e-9:
                    best, best_left = b, left
        if best is None:
            best = Bar(capacity)
            bars.append(best)
        take = length + kerf if best.remaining - length >= kerf else length
        best.used += take
        best.pieces.append(pc)
    total = sum(float(p["length"]) for p in pieces)
    stock = bar_length * len(bars)
    return {
        "count": len(bars),
        "bar_length": bar_length,
        "total_length": round(total, 1),
        "waste_pct": round((stock - total) / stock * 100, 1) if stock else 0.0,
        "bars": [{"pieces": b.pieces, "used": round(b.used, 1), "offcut": round(b.remaining, 1)} for b in bars],
    }
