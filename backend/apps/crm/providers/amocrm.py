"""amoCRM API v4 and OAuth2 (uzbridge amocrm/oauth.py + client.py), used here as a lead source.

OAuth: POST https://{host}/oauth2/access_token {client_id, client_secret, redirect_uri, grant_type,
code | refresh_token} → {access_token, refresh_token, expires_in}. Refresh tokens are single-use: the service
stores a new pair under a row lock. A client secret is only ever sent to an amoCRM / Kommo host.

API: Authorization: Bearer; ~7 requests a second per account; 429 → back off and retry; 204 → nothing.
"""

import re
import threading
import time

import httpx

from apps.crm.providers import http
from apps.crm.providers.http import ProviderError

HOST_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}\.(amocrm\.ru|amocrm\.com|kommo\.com)$")
RATE_PER_SECOND = 7
WON, LOST = 142, 143  # amoCRM's fixed "успешно реализовано" / "закрыто и не реализовано" statuses


class AmoError(ProviderError):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def normalize_host(raw: str) -> str:
    h = str(raw or "").strip().lower().removeprefix("https://").removeprefix("http://").split("/")[0]
    if h and "." not in h:
        h += ".amocrm.ru"
    if not HOST_RE.match(h):
        raise ProviderError("amoCRM manzili noto'g'ri: kompaniya.amocrm.ru")
    return h


def token_request(host: str, client_id: str, client_secret: str, redirect_uri: str, payload: dict) -> dict:
    host = normalize_host(host)
    body = {"client_id": client_id, "client_secret": client_secret, "redirect_uri": redirect_uri, **payload}
    try:
        r = http.request("POST", f"https://{host}/oauth2/access_token", json=body)
    except httpx.HTTPError as exc:
        raise ProviderError(f"amoCRM'ga ulanib bo'lmadi: {exc.__class__.__name__}") from exc
    if r.status_code != 200:
        hint = " — kod eskirgan: integratsiyadagi yangi kodni oling" if "revoked" in r.text.lower() else ""
        raise ProviderError(f"amoCRM token bermadi ({r.status_code}){hint}: {r.text[:200]}")
    return r.json()


_lock = threading.Lock()
_last: list[float] = []


def _throttle() -> None:
    """At most RATE_PER_SECOND requests in any second (one process; Rombo talks to one account)."""
    with _lock:
        now = time.monotonic()
        while _last and now - _last[0] > 1:
            _last.pop(0)
        if len(_last) >= RATE_PER_SECOND:
            time.sleep(max(0.0, 1 - (now - _last[0])) + 0.01)
        _last.append(time.monotonic())


def api(host: str, token: str, method: str, path: str, **kw) -> dict | list | None:
    """One v4 call. 401 is raised as AmoError(401) so the service can refresh and retry once."""
    url = f"https://{normalize_host(host)}{path}"
    for attempt in range(4):
        _throttle()
        try:
            r = http.request(method, url, headers={"Authorization": f"Bearer {token}"}, **kw)
        except httpx.HTTPError as exc:
            raise ProviderError(f"amoCRM'ga ulanib bo'lmadi: {exc.__class__.__name__}") from exc
        if r.status_code == 429 and attempt < 3:
            time.sleep(1 + attempt)
            continue
        if r.status_code == 204:
            return None
        if r.status_code == 401:
            raise AmoError(401, "amoCRM tokeni yaroqsiz")
        if r.status_code in (402, 403):
            raise AmoError(r.status_code, "amoCRM kirishni rad etdi: hisob to'lanmagan yoki integratsiya o'chirilgan")
        if r.status_code >= 400:
            raise AmoError(r.status_code, f"amoCRM xatosi {r.status_code}: {r.text[:300]}")
        return r.json() if r.content else None
    raise AmoError(429, "amoCRM juda ko'p so'rov: keyinroq urinib ko'ring")


def embedded(body, key: str) -> list[dict]:
    return ((body or {}).get("_embedded") or {}).get(key) or []


def contact_phone_name(contact: dict) -> tuple[str, str]:
    phone = ""
    for f in contact.get("custom_fields_values") or []:
        if f.get("field_code") == "PHONE" and f.get("values"):
            phone = str(f["values"][0].get("value") or "")
            break
    return phone, str(contact.get("name") or "")
