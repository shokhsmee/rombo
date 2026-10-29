"""Blocks that leaf apps add to the Loyiha detail (procurement counts, later accounting money).

The hub never imports the apps that hang off it (AGENTS.md §2): a leaf app registers its block from
`AppConfig.ready()`, and `ProjectSerializer` appends `{key: fn(project)}` for every registered block.
"""

from collections.abc import Callable

DETAIL_BLOCKS: dict[str, Callable[[object], dict]] = {}


def register_detail_block(key: str, fn: Callable[[object], dict]) -> None:
    DETAIL_BLOCKS[key] = fn
