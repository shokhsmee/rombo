"""Live events to the browser (uzbridge core/realtime.py, on Django Channels instead of a separate Redis
service). Services call publish(); apps.core.consumers.LiveConsumer forwards to the open sockets.

Channel layer: in-memory in development (one process — `runserver` is daphne's ASGI server), Redis when
REDIS_URL is set (production, and needed as soon as a worker / Telegram listener process publishes too).
Publishing never fails a request: without a socket the pages still refresh on their own.
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import transaction

log = logging.getLogger(__name__)

ALL = "rt.all"


def user_group(user_id: int) -> str:
    return f"rt.user.{user_id}"


def _send(message: dict, user_ids: list[int] | None) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        groups = [user_group(u) for u in user_ids] if user_ids is not None else [ALL]
        for g in groups:
            async_to_sync(layer.group_send)(g, {"type": "live.event", "msg": message})
    except Exception as exc:  # a missed push must never break the request
        log.warning("realtime publish failed: %s", exc)


def publish(message: dict, user_ids: list[int] | None = None) -> None:
    """`user_ids` = only these users (an incoming call for its operator); None = everyone signed in.
    Sent after the transaction commits, so the browser never re-reads data that isn't there yet."""
    if not getattr(settings, "REALTIME_ENABLED", True):
        return
    transaction.on_commit(lambda: _send(message, user_ids))
