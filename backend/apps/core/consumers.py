"""The WebSocket at /ws/live/?token=<JWT access>: one per open tab. Sends {"type": "ping"} every 25 s and
whatever apps.core.realtime.publish() sends to everyone or to this user."""

import asyncio
import contextlib
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.core.realtime import ALL, user_group

PING = 25


@database_sync_to_async
def _user_from_token(token: str):
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    from apps.users.authentication import TOKEN_VERSION_CLAIM
    from apps.users.models import User

    try:
        t = AccessToken(token)
    except TokenError:
        return None
    user = User.objects.filter(pk=t.get("user_id"), is_active=True).first()
    if user is None or t.get(TOKEN_VERSION_CLAIM) != user.token_version:
        return None
    return user


class LiveConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        query = parse_qs(self.scope.get("query_string", b"").decode())
        user = await _user_from_token((query.get("token") or [""])[0])
        if user is None:
            await self.close(code=4401)
            return
        self.groups_joined = [ALL, user_group(user.pk)]
        for g in self.groups_joined:
            await self.channel_layer.group_add(g, self.channel_name)
        await self.accept()
        self.pinger = asyncio.create_task(self._ping())

    async def _ping(self):
        while True:
            await asyncio.sleep(PING)
            await self.send_json({"type": "ping"})

    async def disconnect(self, code):
        if getattr(self, "pinger", None):
            self.pinger.cancel()
        for g in getattr(self, "groups_joined", []):
            await self.channel_layer.group_discard(g, self.channel_name)

    async def receive_json(self, content, **kwargs):
        pass  # the socket only pushes; the browser talks to the REST API

    async def live_event(self, event):
        with contextlib.suppress(Exception):
            await self.send_json(event["msg"])
