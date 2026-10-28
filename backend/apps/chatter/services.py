from django.db import models

from apps.chatter.models import Message
from apps.chatter.tracking import diff, muted, post  # noqa: F401  (re-exported for other apps)
from apps.core.exceptions import ValidationFailed


def event(obj: models.Model, body: str, *, actor=None, changes=None) -> None:
    """A system/service line on the record's history."""
    post(obj, body, kind=Message.Kind.EVENT, changes=changes, actor=actor)


def note_create(obj: models.Model, *, actor, body: str) -> None:
    body = (body or "").strip()
    if not body:
        raise ValidationFailed("Izoh bo'sh", field="body")
    post(obj, body[:4000], kind=Message.Kind.NOTE, actor=actor)
