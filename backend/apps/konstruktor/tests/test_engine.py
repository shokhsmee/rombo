"""add-window-constructor: engine and cutting scenarios (no database)."""

import pytest

from apps.konstruktor.engine import CutError, EngineError, Params, calculate, cut

P = Params(frame_width=60, mullion_width=80, sash_width=76, weld_allowance=3, mullion_allowance=6,
           sash_overlap=8, glass_deduction_fixed=10, glass_deduction_sash=10)


def lengths(res, role):
    return sorted(p.length for p in res.pieces if p.role == role)


def test_fixed_window():
    res = calculate({"w": 1200, "h": 1400, "root": {"fill": "glass"}}, P)
    assert lengths(res, "frame") == [1206, 1206, 1406, 1406]
    assert [(g["w"], g["h"]) for g in res.glass] == [(1070, 1270)]
    assert round(res.glass[0]["m2"], 3) == 1.359
    assert res.area_m2 == pytest.approx(1.68)
    assert lengths(res, "bead") == [1080, 1080, 1280, 1280]
    assert res.counts["sash"] == 0


def test_two_cells_one_mullion():
    res = calculate({"w": 1200, "h": 1400, "root": {"split": "v", "sizes": [600, 600],
                                                     "cells": [{"fill": "glass"}, {"fill": "glass"}]}}, P)
    assert lengths(res, "mullion") == [1286]
    assert len(res.glass) == 2
    # each cell: 600 − 60 (frame) − 40 (half impost) = 500 light opening, glass 490
    assert [g["w"] for g in res.glass] == [490, 490]
    assert res.counts["mullion_ends"] == 2


def test_tilt_turn_sash():
    res = calculate({"w": 1200, "h": 1400, "root": {"split": "v", "sizes": [600, 600], "cells": [
        {"fill": "glass"}, {"fill": "glass", "sash": {"type": "tilt_turn", "hinge": "left"}}]}}, P)
    assert lengths(res, "sash") == [522, 522, 1302, 1302]  # opening 500 × 1280 + 2×8 overlap + 2×3 weld
    assert res.glass[1]["w"] == 354 and res.glass[1]["h"] == 1134  # 516 − 2×76 − 10
    assert res.counts["tilt_turn"] == 1 and res.counts["sash"] == 1
    assert res.lengths_m["rubber_sash"] == pytest.approx(2 * (516 + 1296) / 1000)


def test_nested_split_and_door():
    design = {"w": 2000, "h": 2200, "root": {"split": "v", "sizes": [800, 1200], "cells": [
        {"fill": "panel", "sash": {"type": "door", "hinge": "right"}},
        {"split": "h", "sizes": [1500, 700], "cells": [{"fill": "glass"}, {"fill": "lambri"}]}]}}
    res = calculate(design, P)
    assert res.counts["door"] == 1 and len(lengths(res, "door_sash")) == 4
    assert res.counts["mullion"] == 2
    # the horizontal impost runs from the vertical impost to the frame: 1200 − 40 − 60 + 6
    assert 1106 in lengths(res, "mullion")
    assert {f["fill"] for f in res.fills} == {"panel", "lambri"}


@pytest.mark.parametrize("design, message", [
    ({"w": 1200, "h": 1400, "root": {"split": "v", "sizes": [1250, -50], "cells": [{}, {}]}}, "kichik"),
    ({"w": 1200, "h": 1400, "root": {"split": "v", "sizes": [600, 500], "cells": [{}, {}]}}, "yig'indisi"),
    ({"w": 200, "h": 1400}, "Eni"),
    ({"w": 1200, "h": 1400, "root": {"split": "v", "sizes": [600, 600], "sash": {"type": "turn"},
                                      "cells": [{}, {}]}}, "tabaqa"),
])
def test_invalid(design, message):
    with pytest.raises(EngineError) as e:
        calculate(design, P)
    assert message in e.value.message


def test_same_input_same_output():
    d = {"w": 1500, "h": 1500, "root": {"split": "v", "sizes": [500, 500, 500], "cells": [{}, {}, {}]}}
    assert calculate(d, P).as_dict() == calculate(d, P).as_dict()


def test_cut_one_bar():
    plan = cut([{"length": x, "label": str(x)} for x in (1406, 1406, 1206, 1206)], bar_length=6500, kerf=5)
    assert plan["count"] == 1
    assert plan["bars"][0]["offcut"] == 1256


def test_cut_best_fit_pools_pieces():
    pieces = [{"length": x, "label": ""} for x in (3000, 3000, 3000, 3400, 3400)]
    plan = cut(pieces, bar_length=6500, kerf=5)
    # 3400 + 3000 fit one bar twice; the last 3000 takes a third
    assert plan["count"] == 3


def test_cut_too_long():
    with pytest.raises(CutError) as e:
        cut([{"length": 6800, "label": "Rom — chap"}], bar_length=6500)
    assert "xlistdan uzun" in e.value.message
