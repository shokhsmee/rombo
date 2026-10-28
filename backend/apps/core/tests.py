import pytest
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.test import override_settings
from rest_framework_simplejwt.tokens import AccessToken

from apps.core import crypto
from apps.core.realtime import _send
from apps.users.authentication import TOKEN_VERSION_CLAIM
from apps.users.models import User
from config.asgi import application


def test_encrypted_field_roundtrip_and_mask():
    token = crypto.encrypt("s3cret")
    assert token != "s3cret" and crypto.decrypt(token) == "s3cret"
    assert crypto.mask("abcdefgh12") == "••••••••gh12"


@override_settings(DEBUG=False, FIELD_ENCRYPTION_KEY="")
def test_production_needs_a_real_key():
    from django.core.exceptions import ImproperlyConfigured

    crypto._fernet.cache_clear()
    try:
        with pytest.raises(ImproperlyConfigured):
            crypto.encrypt("x")
    finally:
        crypto._fernet.cache_clear()


def _token(user) -> str:
    t = AccessToken.for_user(user)
    t[TOKEN_VERSION_CLAIM] = user.token_version
    return str(t)


@pytest.mark.django_db(transaction=True)
def test_live_socket_needs_a_token_and_gets_its_events():
    a = User.objects.create_user(username="a", password="a-pass-123")
    b = User.objects.create_user(username="b", password="b-pass-123")

    async def run():
        bad = WebsocketCommunicator(application, "/ws/live/?token=nope", headers=[(b"host", b"localhost"), (b"origin", b"http://localhost")])
        ok, code = await bad.connect()
        assert not ok

        ws = WebsocketCommunicator(application, f"/ws/live/?token={_token(a)}", headers=[(b"host", b"localhost"), (b"origin", b"http://localhost")])
        ok, _ = await ws.connect()
        assert ok
        from asgiref.sync import sync_to_async

        await sync_to_async(_send)({"type": "crm"}, None)
        assert await ws.receive_json_from(timeout=2) == {"type": "crm"}
        await sync_to_async(_send)({"type": "call", "id": 1}, [b.pk])  # someone else's call
        await sync_to_async(_send)({"type": "call", "id": 2}, [a.pk])
        assert await ws.receive_json_from(timeout=2) == {"type": "call", "id": 2}
        await ws.disconnect()

    async_to_sync(run)()
