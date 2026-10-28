"""Secrets at rest (ported from uzbridge core/crypto.py): Fernet tokens in the database, plain str in Python.

Key: env FIELD_ENCRYPTION_KEY — one or more comma-separated Fernet keys, the first encrypts, all decrypt
(rotation: put the new key first, re-save, drop the old one). Generate one with
`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
With DEBUG on and no key, a key derived from SECRET_KEY is used so development and tests need no setup;
production refuses to start encrypting without a real key.
"""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _keys() -> list[bytes]:
    keys = [k.strip().encode() for k in (settings.FIELD_ENCRYPTION_KEY or "").split(",") if k.strip()]
    if keys:
        return keys
    if settings.DEBUG:
        return [base64.urlsafe_b64encode(hashlib.sha256(f"rombo-dev:{settings.SECRET_KEY}".encode()).digest())]
    raise ImproperlyConfigured("FIELD_ENCRYPTION_KEY is empty — set it in backend/.env (see .env.example)")


@lru_cache(maxsize=1)
def _fernet() -> MultiFernet:
    return MultiFernet([Fernet(k) for k in _keys()])


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


class EncryptedTextField(models.TextField):
    """Text stored as a Fernet token; reads back as plain str. Can't be filtered or indexed — secrets are
    only ever read by id."""

    def from_db_value(self, value, expression, connection):
        if value in (None, ""):
            return value
        try:
            return decrypt(value)
        except InvalidToken as exc:
            raise ValueError(f"cannot decrypt {self.model.__name__}.{self.name} — wrong FIELD_ENCRYPTION_KEY?") from exc

    def get_prep_value(self, value):
        if value in (None, ""):
            return value
        return encrypt(str(value))


def mask(value: str | None, visible: int = 4) -> str:
    """'••••••••a1b2' — how a stored secret is shown back."""
    if not value:
        return ""
    if len(value) <= visible:
        return "•" * len(value)
    return "•" * 8 + value[-visible:]
