from types import SimpleNamespace

import pytest
from django.db import connection

from apps.crm.models import Lead
from apps.telegram import client as tg
from apps.telegram import services
from apps.telegram.models import Account, Chat
from apps.users.models import User
from conftest import API, login

SECRET_TEXT = "Salom, menga 3 ta deraza kerak — narxi qancha?"


class FakeTelegram:
    """Stands in for Telethon: records ops, answers like ops.OPS would."""

    def __init__(self):
        self.ops = []
        self.need_password = False

    def call(self, account, op, timeout=90, **args):
        self.ops.append((op, args))
        if op == "dialogs":
            return [{"chat_id": 555, "access_hash": 99, "kind": "private", "name": "Botir Aka", "username": "botir",
                     "phone": "998905550000", "read_outbox_max_id": 3, "unread": 2, "photo": None,
                     "last": {"tg_id": 4, "out": False, "date": "2026-10-29T10:00:00+00:00", "text": SECRET_TEXT}}]
        if op == "history":
            return [{"tg_id": 4, "out": False, "date": "2026-10-29T10:00:00+00:00", "text": SECRET_TEXT}]
        if op == "send":
            return {"tg_id": 5, "out": True, "date": "2026-10-29T10:01:00+00:00", "text": args["text"]}
        return True

    def send_code(self, account):
        return "HASH", "LOGIN-SESSION"

    def sign_in(self, account, code="", password=""):
        if self.need_password and not password:
            return None, "LOGIN-SESSION-2"
        return SimpleNamespace(id=777, first_name="Rombo", last_name="Sotuv", username="rombo_sales"), "SESSION"


@pytest.fixture
def fake_tg(monkeypatch, settings):
    settings.TELEGRAM_API_ID, settings.TELEGRAM_API_HASH = 12345, "apihash"
    fake = FakeTelegram()
    monkeypatch.setattr(tg, "call", fake.call)
    monkeypatch.setattr(tg, "send_code", fake.send_code)
    monkeypatch.setattr(tg, "sign_in", fake.sign_in)
    return fake


def _connect(client, phone="+998 90 000 11 22", **flags):
    acc = client.post(f"{API}/telegram/accounts/", {"phone": phone, **flags}, format="json")
    assert acc.status_code == 201, acc.content
    pk = acc.json()["id"]
    assert client.post(f"{API}/telegram/accounts/{pk}/send-code/").json()["status"] == "code_sent"
    r = client.post(f"{API}/telegram/accounts/{pk}/sign-in/", {"code": "12345"}, format="json").json()
    return pk, r


def test_needs_api_credentials(admin):
    r = admin.post(f"{API}/telegram/accounts/", {"phone": "+998900001122"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["field"] == "api_id"


def test_sign_in_with_2fa_then_dialogs(admin, fake_tg):
    fake_tg.need_password = True
    pk, r = _connect(admin)
    assert r["need_password"] is True and r["account"]["status"] == "password"
    fake_tg.need_password = False
    r = admin.post(f"{API}/telegram/accounts/{pk}/sign-in/", {"password": "2fa"}, format="json").json()
    assert r["done"] is True and r["account"]["status"] == "connected" and r["account"]["name"] == "Rombo Sotuv"
    acc = Account.objects.get(pk=pk)
    with connection.cursor() as cur:
        cur.execute("select session from telegram_account")
        assert cur.fetchone()[0].startswith("gAAAA")  # the session is encrypted at rest
    assert acc.session == "SESSION"
    chats = admin.get(f"{API}/telegram/chats/").json()
    assert [(c["name"], c["unread"], c["phone"]) for c in chats] == [("Botir Aka", 2, "+998905550000")]
    live = admin.get(f"{API}/telegram/chats/live/").json()
    assert live[0]["last"]["text"] == SECRET_TEXT  # shown, never stored


def test_incoming_private_message_makes_client_and_lead_without_text(admin, fake_tg):
    pk, _ = _connect(admin, crm_leads=True)
    acc = Account.objects.get(pk=pk)
    peer = {"chat_id": 901, "access_hash": 1, "kind": "private", "name": "Gulnora", "username": "",
            "phone": "998931230000"}
    msg = {"tg_id": 10, "out": False, "date": "2026-10-29T11:00:00+00:00", "text": SECRET_TEXT}
    chat = services.ingest(acc, peer, msg)
    assert chat.client and chat.client.name == "Gulnora" and chat.client.phone == "+998 93 123 00 00"
    assert chat.lead and chat.lead.source is None or chat.lead.title == "Gulnora"
    assert Chat.objects.get(pk=chat.pk).unread == 1
    services.ingest(acc, peer, {**msg, "tg_id": 11})  # a second message: same lead
    assert Lead.objects.count() == 1 and Chat.objects.get(pk=chat.pk).unread == 2
    with connection.cursor() as cur:
        for table in ("telegram_chat", "telegram_account", "crm_lead", "clients_client", "chatter_message"):
            cur.execute(f"select * from {table}")  # noqa: S608 — fixed table names
            assert SECRET_TEXT not in repr(cur.fetchall())


def test_open_send_and_owner_only(api, admin, fake_tg):
    pk, _ = _connect(admin)
    chat = admin.get(f"{API}/telegram/chats/").json()[0]
    opened = admin.post(f"{API}/telegram/chats/{chat['id']}/open/").json()
    assert opened["messages"][0]["text"] == SECRET_TEXT and Chat.objects.get(pk=chat["id"]).unread == 0
    sent = admin.post(f"{API}/telegram/chats/{chat['id']}/send/", {"text": " Assalomu alaykum "}, format="json").json()
    assert sent["text"] == "Assalomu alaykum" and fake_tg.ops[-1][0] == "send"
    assert admin.post(f"{API}/telegram/chats/{chat['id']}/send/", {"text": " "}, format="json").status_code == 400
    lead = admin.post(f"{API}/telegram/chats/{chat['id']}/lead/").json()["lead"]
    assert Lead.objects.get(pk=lead["id"]).phone == "+998 90 555 00 00"

    other = User.objects.create_user(username="colleague", password="colleague-123", is_superuser=True)
    them = login(api, other.username, "colleague-123")
    assert them.get(f"{API}/telegram/chats/").json() == []  # never someone else's chats
    assert them.post(f"{API}/telegram/chats/{chat['id']}/open/").status_code == 404
    assert them.patch(f"{API}/telegram/accounts/{pk}/", {"name": "x"}, format="json").status_code == 403
    assert them.post(f"{API}/telegram/accounts/{pk}/disconnect/").json()["status"] == "new"  # a manager may
