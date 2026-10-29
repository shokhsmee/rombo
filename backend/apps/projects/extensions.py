"""Blocks that leaf apps add to the Loyiha detail (procurement counts, accounting money, kassa payments).

The hub never imports the apps that hang off it (AGENTS.md §2): a leaf app registers its block from
`AppConfig.ready()`, and `ProjectSerializer` appends `{key: fn(project)}` for every registered block.
Block values must be JSON-ready (strings for money, never raw Decimals).

`register_advance_source` is the one hook that feeds a *stored* field: kassa registers a function that
returns `{"amount": Decimal, "date": date}` once the Loyiha has a posted customer payment (else None);
`projects.services` then derives `advance_amount` / `advance_date` from it and ignores typed values.
"""

from collections.abc import Callable

DETAIL_BLOCKS: dict[str, Callable[[object], dict]] = {}

_ADVANCE_SOURCE: list[Callable[[object], dict | None]] = []


def register_detail_block(key: str, fn: Callable[[object], dict]) -> None:
    DETAIL_BLOCKS[key] = fn


def register_advance_source(fn: Callable[[object], dict | None]) -> None:
    _ADVANCE_SOURCE[:] = [fn]


def derived_advance(project) -> dict | None:
    """`{"amount", "date"}` when a registered source derives the advance for this Loyiha, else None."""
    return _ADVANCE_SOURCE[0](project) if _ADVANCE_SOURCE else None
