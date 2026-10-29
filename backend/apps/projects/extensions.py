"""Hooks the apps that hang off the Loyiha use to add to its card without projects importing them
(ADR 0004, ADR 0007). `accounting` registers "money" in its AppConfig.ready()."""

from collections.abc import Callable

DetailExtra = Callable[[object], object]

_DETAIL_EXTRAS: dict[str, DetailExtra] = {}


def register_detail_extra(key: str, fn: DetailExtra) -> None:
    _DETAIL_EXTRAS[key] = fn


def detail_extra(key: str, project, default=None):
    fn = _DETAIL_EXTRAS.get(key)
    return fn(project) if fn is not None else default
