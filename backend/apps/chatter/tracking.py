"""Field tracking for any model, like Odoo's tracking=True (ported from uzbridge).

A model opts in with a TRACK dict ({"field": "Label"}). Creating a record and changing tracked fields
are written to chatter.Message by signals. Who did it comes from the request being served
(ChatterMiddleware), or "" (system) for commands and scripts. Errors here never break a save.
"""

from __future__ import annotations

import contextvars
import datetime as dt
import logging
from decimal import Decimal

from django.apps import apps
from django.db import models
from django.db.models.signals import post_init, post_save

log = logging.getLogger(__name__)

_request: contextvars.ContextVar = contextvars.ContextVar("chatter_request", default=None)
_muted: contextvars.ContextVar = contextvars.ContextVar("chatter_muted", default=False)


class ChatterMiddleware:
    """Remembers the request; the user is read lazily because DRF authenticates later, inside the view."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _request.set(request)
        try:
            return self.get_response(request)
        finally:
            _request.reset(token)


class muted:
    """`with muted():` — saves that should not fill the history (imports, or a service posting its own line)."""

    def __enter__(self):
        self.t = _muted.set(True)

    def __exit__(self, *exc):
        _muted.reset(self.t)


def current_actor() -> tuple[object | None, str]:
    req = _request.get()
    user = getattr(req, "user", None) if req is not None else None
    if user is None or not getattr(user, "is_authenticated", False):
        return None, ""
    return user, (getattr(user, "full_name", "") or user.get_username())[:150]


def label_of(obj_or_cls) -> str:
    return f"{obj_or_cls._meta.app_label}.{obj_or_cls._meta.model_name}"


def post(obj: models.Model, body: str = "", *, kind: str = "event", changes=None, actor=None) -> None:
    """Writes one history line on `obj`. `actor` overrides the request user (services pass it explicitly)."""
    if _muted.get() or obj.pk is None:
        return
    from apps.chatter.models import Message

    if actor is not None:
        user, name = actor, (getattr(actor, "full_name", "") or actor.get_username())[:150]
    else:
        user, name = current_actor()
    try:
        Message.objects.create(model=label_of(obj), res_id=obj.pk, kind=kind, body=body[:4000],
                               changes=changes or [], author=name, user=user)
    except Exception:  # history must never break the business save
        log.exception("chatter: could not write a message for %s", label_of(obj))


def show(obj: models.Model, field: str, value) -> str:
    """A tracked value as a person reads it: choice labels, related names, dates, money."""
    if value is None or value == "":
        return "—"
    f = obj._meta.get_field(field)
    if f.choices:
        return str(dict(f.flatchoices).get(value, value))
    if isinstance(f, models.ForeignKey):
        rel = f.related_model._base_manager.filter(pk=value).first()
        return str(rel) if rel is not None else f"#{value}"
    if isinstance(value, bool):
        return "Ha" if value else "Yo'q"
    if isinstance(value, dt.datetime):
        return value.strftime("%d.%m.%Y %H:%M")
    if isinstance(value, dt.date):
        return value.strftime("%d.%m.%Y")
    if isinstance(f, models.DecimalField):
        try:
            return f"{Decimal(str(value)).normalize():,f}".replace(",", " ")
        except Exception:
            return str(value)
    if isinstance(value, str) and isinstance(f, models.DateField) and not isinstance(f, models.DateTimeField):
        try:
            return dt.date.fromisoformat(value[:10]).strftime("%d.%m.%Y")
        except ValueError:
            return value
    return str(value)


def diff(instance: models.Model, old: dict, fields: dict[str, str]) -> list[dict]:
    """Tracked changes between a snapshot and the instance now, as [{field, label, old, new}]."""
    changes = []
    for f, label in fields.items():
        a, b = old.get(f, _UNSET), instance.__dict__.get(_attname(instance, f), _UNSET)
        if a is _UNSET or b is _UNSET or a == b or (a in (None, "") and b in (None, "")):
            continue
        old_s, new_s = show(instance, f, a), show(instance, f, b)
        if old_s != new_s:  # "2026-10-02" over a date, 2190 over Decimal("2190.00")…
            changes.append({"field": f, "label": label, "old": old_s, "new": new_s})
    return changes


def _attname(obj, field: str) -> str:
    return obj._meta.get_field(field).attname


_UNSET = object()


def _snapshot(sender, instance, **kw):
    # __dict__, not getattr: a deferred field (.only()) would load itself and recurse through post_init
    d = instance.__dict__
    instance._chatter_old = {f: d.get(_attname(instance, f), _UNSET) for f in sender.TRACK}


def _saved(sender, instance, created, raw=False, **kw):
    if raw:
        return
    try:
        if created:
            name = getattr(sender, "CHATTER_NAME", sender._meta.verbose_name)
            post(instance, f"{name} yaratildi")
        else:
            old = getattr(instance, "_chatter_old", None)
            if old is not None:
                changes = diff(instance, old, sender.TRACK)
                if changes:
                    post(instance, kind="track", changes=changes)
    finally:
        _snapshot(sender, instance)


def connect_all() -> None:
    for model in apps.get_models():
        if isinstance(getattr(model, "TRACK", None), dict):
            uid = label_of(model)
            post_init.connect(_snapshot, sender=model, weak=False, dispatch_uid=f"chatter-init-{uid}")
            post_save.connect(_saved, sender=model, weak=False, dispatch_uid=f"chatter-save-{uid}")
