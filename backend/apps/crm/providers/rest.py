"""A small REST client for provider APIs whose base URL, paths and auth are set per connection (uzbridge
crm/rest.py): auth_mode bearer | header | query | basic, credentials from the connection's secrets."""

from datetime import datetime
from typing import Any

import httpx

from apps.crm.providers import http
from apps.crm.providers.http import ProviderError

LIST_KEYS = ("data", "items", "calls", "records", "result", "results", "leads", "list", "rows")


class RestClient:
    def __init__(self, conn):
        self.cfg = conn.config or {}
        self.sec = conn.get_secrets()
        base = str(self.cfg.get("base_url") or "").strip().rstrip("/")
        if not base.startswith(("http://", "https://")):
            raise ProviderError("API manzili kiritilmagan (https://…)")
        self.base = base

    def _auth(self):
        mode = self.cfg.get("auth_mode") or "bearer"
        key = self.sec.get("api_key") or ""
        name = str(self.cfg.get("key_name") or "").strip()
        headers = {"Accept": "application/json"}
        params: dict[str, str] = {}
        auth = None
        if mode == "basic":
            if not (self.cfg.get("login") and self.sec.get("password")):
                raise ProviderError("Login va parol kiritilmagan")
            auth = (self.cfg["login"], self.sec["password"])
        elif not key:
            raise ProviderError("API kalit kiritilmagan")
        elif mode == "header":
            headers[name or "X-API-Key"] = key
        elif mode == "query":
            params[name or "api_key"] = key
        else:
            headers["Authorization"] = f"Bearer {key}"
        return headers, params, auth

    def request(self, method: str, path: str, *, params: dict | None = None, json_body: Any = None) -> Any:
        headers, auth_params, auth = self._auth()
        url = self.base + "/" + (path or "").lstrip("/")
        try:
            r = http.request(method, url, params={**auth_params, **(params or {})}, json=json_body,
                             headers=headers, auth=auth, follow_redirects=True)
        except httpx.HTTPError as exc:
            raise ProviderError(f"Serverga ulanib bo'lmadi: {exc.__class__.__name__}") from exc
        if r.status_code in (401, 403):
            raise ProviderError(f"Kirish rad etildi ({r.status_code}): kalit yoki login/parolni tekshiring")
        if r.status_code == 404:
            raise ProviderError(f"Yo'l topilmadi (404): {path}")
        if r.status_code >= 400:
            raise ProviderError(f"Server xatosi {r.status_code}: {r.text[:200]}")
        try:
            return r.json()
        except ValueError:
            return r.text

    def list(self, path: str, *, since: datetime, until: datetime) -> list[dict]:
        fp = self.cfg.get("from_param") or "date_from"
        tp = self.cfg.get("to_param") or "date_to"
        params = {fp: since.strftime("%Y-%m-%d %H:%M:%S"), tp: until.strftime("%Y-%m-%d %H:%M:%S")}
        return as_list(self.request("GET", path, params=params))


def as_list(body: Any) -> list[dict]:
    """The records in a provider's answer: a bare list or one under data / items / calls …"""
    if isinstance(body, list):
        return [x for x in body if isinstance(x, dict)]
    if isinstance(body, dict):
        for k in LIST_KEYS:
            v = body.get(k)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
            if isinstance(v, dict):
                inner = as_list(v)
                if inner:
                    return inner
    return []
