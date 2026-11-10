"""Claude's way into the ERP: run the real API view in-process, as the token's user.

Nothing here knows about business rules. The view's own PagePermission, serializers and services decide,
exactly as for a browser request (ADR 0014). Only viewsets guarded by a `page_key` (and chatter, which checks
the record's page itself) are reachable; login, tokens, schema, webhooks and Mini App APIs are not.
"""

from __future__ import annotations

import functools
import json
import logging
import re
from dataclasses import dataclass
from urllib.parse import urlencode

from django.test import RequestFactory
from django.urls import Resolver404, URLPattern, URLResolver, get_resolver, resolve

from apps.access.permissions import DEFAULT_ACTION_MAP
from apps.access.registry import PAGE_BY_KEY, Action
from apps.access.services import effective_permissions
from apps.chatter.tracking import serving

log = logging.getLogger(__name__)

API_PREFIX = "/api/v1/"
BLOCKED_PREFIXES = ("auth/", "mcp/", "schema/", "docs/")
EXTRA_ALLOWED_PREFIXES = ("chatter/",)  # no page_key: each call checks the record's own page
WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")
MAX_TEXT = 60_000  # characters of a response handed back to the model


class BridgeError(Exception):
    pass


@dataclass
class ApiResult:
    status: int
    data: object

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300


def normalize(path: str) -> tuple[str, str]:
    """'/api/v1/clients/3?x=1' | 'clients/3' → ('clients/3/', 'x=1')."""
    path = (path or "").strip()
    path, _, query = path.partition("?")
    path = path.lstrip("/")
    if path.startswith("api/v1/"):
        path = path[len("api/v1/"):]
    if ".." in path or "//" in path or not path:
        raise BridgeError("Noto'g'ri yo'l")
    if not path.endswith("/"):
        path += "/"
    return path, query


def check_path(path: str):
    """Resolve and vet a normalized path; returns the URL match."""
    if path.startswith(BLOCKED_PREFIXES):
        raise BridgeError(f"'{path}' Claude uchun yopiq")
    try:
        match = resolve(API_PREFIX + path)
    except Resolver404 as e:
        raise BridgeError(f"'{path}' topilmadi — list_resources bilan yo'llarni ko'ring") from e
    cls = getattr(match.func, "cls", None)
    if not getattr(cls, "page_key", None) and not path.startswith(EXTRA_ALLOWED_PREFIXES):
        raise BridgeError(f"'{path}' Claude uchun yopiq")
    return match


def call(user, method: str, path: str, *, params: dict | None = None, body=None, origin=None) -> ApiResult:
    """One API call as `user`. `origin` is the MCP HTTP request (host / scheme for absolute links)."""
    method = method.upper()
    if method not in ("GET", *WRITE_METHODS):
        raise BridgeError(f"Metod {method} qo'llanmaydi")
    path, query = normalize(path)
    match = check_path(path)

    qs = query
    if params:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        qs = "&".join(filter(None, [query, urlencode(clean, doseq=True)]))
    url = API_PREFIX + path + (f"?{qs}" if qs else "")
    meta = {}
    if origin is not None:
        meta = {"HTTP_HOST": origin.get_host(), "wsgi.url_scheme": origin.scheme}
    rf = RequestFactory(**meta)
    if method == "GET":
        request = rf.get(url)
    else:
        request = rf.generic(method, url, data=json.dumps(body if body is not None else {}),
                             content_type="application/json")
    request.user = user
    request._force_auth_user = user  # DRF: authenticate as this user, skip the JWT header
    request._dont_enforce_csrf_checks = True

    with serving(request):
        try:
            response = match.func(request, *match.args, **match.kwargs)
            if hasattr(response, "render"):
                response.render()
        except Exception:  # a bug in a view must not kill the MCP session
            log.exception("mcp bridge %s %s", method, path)
            return ApiResult(500, {"error": {"code": "server_error", "message": "Server xatosi"}})
    return ApiResult(response.status_code, _payload(response))


def _payload(response):
    ctype = response.get("Content-Type", "")
    if getattr(response, "streaming", False):
        return {"file": True, "content_type": ctype, "note": "Fayl — brauzerda yuklab oling"}
    raw = response.content or b""
    if "json" in ctype:
        try:
            return json.loads(raw)
        except ValueError:
            pass
    if ctype.startswith("text/"):
        return {"content_type": ctype, "text": raw.decode("utf-8", "replace")[:MAX_TEXT]}
    return {"file": True, "content_type": ctype, "bytes": len(raw)} if raw else None


# --------------------------------------------------------------------------- discovery

_PARAM = re.compile(r"\(\?P<(\w+)>[^)]*\)")


def _clean(regex: str) -> str:
    s = _PARAM.sub(r"{\1}", regex)
    s = s.replace("^", "").replace("$", "").replace("\\", "")
    s = re.sub(r"<(?:\w+:)?(\w+)>", r"{\1}", s)  # path converters: <int:pk>
    return s


def _walk(patterns, prefix=""):
    for p in patterns:
        if isinstance(p, URLResolver):
            yield from _walk(p.url_patterns, prefix + _clean(str(p.pattern)))
        elif isinstance(p, URLPattern):
            yield prefix + _clean(str(p.pattern)), p


@functools.cache
def catalog() -> tuple[dict, ...]:
    """Every page-guarded API endpoint, grouped by view class. Built once per process."""
    groups: dict[type, dict] = {}
    for route, pattern in _walk(get_resolver().url_patterns):
        if not route.startswith(API_PREFIX.lstrip("/")):
            continue
        path = route[len(API_PREFIX) - 1:]
        cls = getattr(pattern.callback, "cls", None)
        page = getattr(cls, "page_key", None)
        if not page or path.startswith(BLOCKED_PREFIXES):
            continue
        group = groups.setdefault(cls, {"page": page, "paths": set(), "endpoints": []})
        group["paths"].add(path)
        actions = getattr(pattern.callback, "actions", None) or {
            m: m for m in ("get", "post", "put", "patch", "delete") if hasattr(cls, m)
        }
        amap = getattr(cls, "permission_action_map", {}) or {}
        for http_method, view_action in actions.items():
            if http_method.upper() not in ("GET", *WRITE_METHODS):
                continue
            if http_method not in getattr(cls, "http_method_names", ["get"]):
                continue
            need = amap.get(view_action) or DEFAULT_ACTION_MAP.get(view_action, Action.VIEW)
            group["endpoints"].append({"method": http_method.upper(), "path": path, "action": view_action,
                                       "needs": str(need.value if isinstance(need, Action) else need)})
    out = []
    for cls, g in groups.items():
        resource = min(g["paths"], key=len).rstrip("/")
        doc = (cls.__doc__ or "").strip().splitlines()
        page = PAGE_BY_KEY[g["page"]]
        out.append({"resource": resource, "page": g["page"], "page_label": page.label, "group": page.group,
                    "about": doc[0] if doc else "",
                    "endpoints": sorted(g["endpoints"], key=lambda e: (e["path"], e["method"]))})
    return tuple(sorted(out, key=lambda r: (r["group"], r["resource"])))


def resources_for(user, *, can_write: bool, group: str | None = None) -> list[dict]:
    perms = effective_permissions(user)
    out = []
    for r in catalog():
        allowed = perms.get(r["page"], [])
        if "view" not in allowed or (group and r["group"].lower() != group.lower()):
            continue
        endpoints = [e for e in r["endpoints"]
                     if e["needs"] in allowed and (can_write or e["method"] == "GET")]
        out.append({**r, "allowed": allowed, "endpoints": endpoints})
    return out
