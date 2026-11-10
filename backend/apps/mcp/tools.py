"""The tools Claude sees. Each declares the page it needs; tools the user can't use are not listed at all.

ERP data goes through `bridge.call` (the real API, as the user). Specs are read from the synced copy
(apps.specs). Ideas are written through apps.specs services with `source=mcp`.
"""

from __future__ import annotations

import functools
import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field

from apps.access.registry import PAGE_BY_KEY, Action, Pages
from apps.access.services import effective_permissions, has_permission
from apps.core.exceptions import DomainError
from apps.mcp import bridge
from apps.mcp.models import McpToken
from apps.specs import selectors as spec_selectors
from apps.specs import services as spec_services
from apps.specs.models import DocKind, FixIdea, IdeaKind, IdeaPriority, IdeaSource, IdeaStatus, SpecDocument

MAX_TEXT = 60_000


class ToolError(Exception):
    """Shown to the model as a tool error (isError: true), not a protocol error."""


@dataclass
class Context:
    token: McpToken
    origin: object = None  # the MCP HTTP request

    @property
    def user(self):
        return self.token.user


@dataclass(frozen=True)
class Tool:
    name: str
    title: str
    description: str
    handler: Callable[[Context, dict], object]
    properties: dict = field(default_factory=dict)
    required: tuple[str, ...] = ()
    page: str | None = None
    action: Action = Action.VIEW
    write: bool = False  # needs a write-scope token
    read_only: bool = True
    destructive: bool = False

    def allowed(self, ctx: Context) -> bool:
        if self.write and not ctx.token.can_write:
            return False
        return self.page is None or has_permission(ctx.user, self.page, self.action)

    def definition(self) -> dict:
        return {
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "inputSchema": {"type": "object", "properties": self.properties, "required": list(self.required),
                            "additionalProperties": False},
            "annotations": {"title": self.title, "readOnlyHint": self.read_only,
                            "destructiveHint": self.destructive, "idempotentHint": self.read_only,
                            "openWorldHint": False},
        }


def _str(desc: str, **kw) -> dict:
    return {"type": "string", "description": desc, **kw}


# --------------------------------------------------------------------------- ERP


def whoami(ctx: Context, args: dict) -> dict:
    u = ctx.user
    return {
        "user": {"id": u.pk, "username": u.username, "full_name": u.full_name, "is_superuser": u.is_superuser},
        "roles": list(u.roles.values_list("name", flat=True)),
        "token": {"name": ctx.token.name, "scope": ctx.token.scope, "expires_at": ctx.token.expires_at},
        "permissions": {k: {"label": PAGE_BY_KEY[k].label, "actions": v}
                        for k, v in effective_permissions(u).items() if k in PAGE_BY_KEY},
    }


def list_resources(ctx: Context, args: dict) -> dict:
    items = bridge.resources_for(ctx.user, can_write=ctx.token.can_write, group=args.get("group"))
    return {"base": "/api/v1/", "resources": items,
            "hint": "Ro'yxatlar: ?q=&page=&size=&sort=-created_at → {items,total,page,size}. "
                    "{pk} = yozuv id. Maydonlar uchun describe_endpoint."}


def api_get(ctx: Context, args: dict) -> dict:
    return _bridge(ctx, "GET", args["path"], params=args.get("params"))


def api_write(ctx: Context, args: dict) -> dict:
    method = (args.get("method") or "").upper()
    if method not in bridge.WRITE_METHODS:
        raise ToolError("method: POST, PUT, PATCH yoki DELETE")
    return _bridge(ctx, method, args["path"], body=args.get("body"))


def _bridge(ctx: Context, method: str, path: str, *, params=None, body=None) -> dict:
    try:
        result = bridge.call(ctx.user, method, path, params=params, body=body, origin=ctx.origin)
    except bridge.BridgeError as e:
        raise ToolError(str(e)) from e
    if not result.ok:
        raise ToolError(json.dumps({"status": result.status, **({"response": result.data} if result.data else {})},
                                   ensure_ascii=False, default=str))
    return {"status": result.status, "data": result.data}


@functools.cache
def _openapi() -> dict:
    from drf_spectacular.generators import SchemaGenerator

    return SchemaGenerator().get_schema(request=None, public=True)


def _deref(node, schema: dict, depth: int = 0):
    if depth > 4:
        return node
    if isinstance(node, dict):
        if "$ref" in node:
            name = node["$ref"].rsplit("/", 1)[-1]
            return _deref(schema.get("components", {}).get("schemas", {}).get(name, {}), schema, depth + 1)
        return {k: _deref(v, schema, depth) for k, v in node.items()}
    if isinstance(node, list):
        return [_deref(v, schema, depth) for v in node]
    return node


def describe_endpoint(ctx: Context, args: dict) -> dict:
    method = (args.get("method") or "GET").lower()
    try:
        path, _ = bridge.normalize(args["path"])
        bridge.check_path(re.sub(r"\{\w+\}", "0", path))
    except bridge.BridgeError as e:
        raise ToolError(str(e)) from e
    target = bridge.API_PREFIX + re.sub(r"\{\w+\}", "0", path)
    schema = _openapi()
    for key, ops in schema.get("paths", {}).items():
        if re.fullmatch(re.sub(r"\\\{\w+\\\}", r"[^/]+", re.escape(key)), target) and method in ops:
            op = ops[method]
            responses = op.get("responses", {})
            ok = next((responses[c] for c in ("200", "201", "204") if c in responses), {})
            body = op.get("requestBody", {}).get("content", {})
            return {
                "path": key, "method": method.upper(), "summary": op.get("summary") or op.get("description", ""),
                "parameters": [{k: p.get(k) for k in ("name", "in", "required", "description", "schema")}
                               for p in op.get("parameters", [])],
                "request_body": _deref(next(iter(body.values()), {}).get("schema"), schema),
                "response": _deref(next(iter(ok.get("content", {}).values()), {}).get("schema"), schema),
            }
    raise ToolError(f"{method.upper()} {path} sxemada yo'q")


# --------------------------------------------------------------------------- specs


def project_context(ctx: Context, args: dict) -> dict:
    doc = SpecDocument.objects.filter(kind=DocKind.PROJECT).first()
    if doc is None:
        raise ToolError("Spetsifikatsiyalar hali yuklanmagan (manage.py specs_sync)")
    return {"path": doc.path, "content": doc.content, "synced_at": doc.synced_at}


def specs_list(ctx: Context, args: dict) -> dict:
    last = SpecDocument.objects.order_by("-synced_at").values_list("synced_at", flat=True).first()
    return {"synced_at": last, "capabilities": spec_selectors.capabilities(),
            "active_changes": spec_selectors.changes()}


def spec_read(ctx: Context, args: dict) -> dict:
    cap = args["capability"].strip().strip("/")
    doc = SpecDocument.objects.filter(kind=DocKind.SPEC, ref=cap).first()
    if doc is None:
        raise ToolError(f"'{cap}' yo'q. specs_list dan tanlang")
    return {"path": doc.path, "content": doc.content}


def specs_search(ctx: Context, args: dict) -> dict:
    kinds = [args["kind"]] if args.get("kind") else None
    return {"results": spec_selectors.search(args["query"], kinds=kinds, limit=min(int(args.get("limit") or 20), 50))}


def changes_list(ctx: Context, args: dict) -> dict:
    return {"changes": spec_selectors.changes(archived=bool(args.get("archived")))}


def change_read(ctx: Context, args: dict) -> dict:
    change = args["change"].strip().strip("/")
    docs = SpecDocument.objects.filter(kind__in=[DocKind.CHANGE, DocKind.ARCHIVED], ref=change).order_by("path")
    if not docs:  # archived folders carry a date: allow the bare change id
        docs = SpecDocument.objects.filter(kind=DocKind.ARCHIVED, ref__regex=rf"^\d{{4}}-\d{{2}}-\d{{2}}-{re.escape(change)}$")
    if not docs:
        raise ToolError(f"'{change}' o'zgarishi yo'q. changes_list dan tanlang")
    text = "\n\n".join(f"<!-- {d.path} -->\n{d.content}" for d in docs)
    return {"change": docs[0].ref, "kind": docs[0].kind, "files": [d.path for d in docs], "content": text[:MAX_TEXT]}


def specs_check(ctx: Context, args: dict) -> dict:
    problems = spec_selectors.db_problems()
    return {"in_sync": not problems, "problems": problems}


# --------------------------------------------------------------------------- ideas


def _idea(i: FixIdea, *, full: bool = False) -> dict:
    row = {"id": i.pk, "code": i.code, "title": i.title, "kind": i.kind, "capability": i.capability,
           "priority": i.priority, "status": i.status, "source": i.source, "change_id": i.change_id,
           "created_by": i.created_by.full_name if i.created_by else "", "created_at": i.created_at}
    if full:
        row |= {"problem": i.problem, "proposal": i.proposal, "impact": i.impact, "resolution": i.resolution}
    return row


def ideas_list(ctx: Context, args: dict) -> dict:
    qs = FixIdea.objects.select_related("created_by")
    for key in ("status", "capability", "kind"):
        if args.get(key):
            qs = qs.filter(**{key: args[key]})
    if args.get("q"):
        for w in args["q"].split():
            qs = qs.filter(title__icontains=w) | qs.filter(problem__icontains=w)
    return {"total": qs.count(), "items": [_idea(i) for i in qs[:50]]}


def idea_get(ctx: Context, args: dict) -> dict:
    ref = str(args["idea"]).strip()
    qs = FixIdea.objects.select_related("created_by")
    idea = qs.filter(code__iexact=ref).first() or (qs.filter(pk=int(ref)).first() if ref.isdigit() else None)
    if idea is None:
        raise ToolError(f"Taklif {ref} topilmadi")
    return _idea(idea, full=True)


def idea_create(ctx: Context, args: dict) -> dict:
    fields = {k: args[k] for k in ("title", "kind", "capability", "priority", "problem", "proposal", "impact")
              if args.get(k) is not None}
    if fields.get("kind", IdeaKind.FIX) not in IdeaKind.values:
        raise ToolError(f"kind: {', '.join(IdeaKind.values)}")
    if fields.get("priority", IdeaPriority.NORMAL) not in IdeaPriority.values:
        raise ToolError(f"priority: {', '.join(IdeaPriority.values)}")
    if fields.get("capability") and not SpecDocument.objects.filter(kind=DocKind.SPEC, ref=fields["capability"]).exists():
        raise ToolError(f"capability '{fields['capability']}' yo'q — specs_list dan oling yoki bo'sh qoldiring")
    try:
        idea = spec_services.idea_create(actor=ctx.user, source=IdeaSource.MCP, **fields)
    except DomainError as e:
        raise ToolError(e.message) from e
    return {"created": _idea(idea), "note": "Taklif 'Takliflar' sahifasida ko'rib chiqiladi."}


# --------------------------------------------------------------------------- registry

_IDEA_FIELDS = {
    "title": _str("Qisqa sarlavha (3–200 belgi)"),
    "kind": _str("fix = xato, improvement = yaxshilash, feature = yangi imkoniyat", enum=IdeaKind.values),
    "capability": _str("openspec/specs dagi bo'lim nomi (specs_list), masalan 'procurement'"),
    "priority": _str("Muhimlik", enum=IdeaPriority.values),
    "problem": _str("Nima noto'g'ri yoki nima yetishmaydi — dalil bilan (spec talabi, API javobi)"),
    "proposal": _str("Nima o'zgarishi kerak (ro'yxat ko'rinishida)"),
    "impact": _str("Ta'sir: ilovalar, jadvallar, endpointlar, sahifalar"),
}

TOOLS: tuple[Tool, ...] = (
    Tool("whoami", "Men kimman", "Joriy foydalanuvchi, rollari, sahifa ruxsatlari va token turi.", whoami),
    Tool("list_resources", "ERP resurslari",
         "ERP API resurslari: foydalanuvchi ko'ra oladigan har bir bo'lim, uning yo'llari va ruxsat etilgan "
         "amallari. Har qanday ish shundan boshlanadi.", list_resources,
         {"group": _str("Faqat shu menyu guruhi, masalan 'Ta'minot', 'Servis'")}),
    Tool("describe_endpoint", "Endpoint sxemasi",
         "Bitta endpointning parametrlar va so'rov/javob maydonlari (OpenAPI).", describe_endpoint,
         {"path": _str("Masalan 'maintenance/requests/{pk}/assign/'"),
          "method": _str("GET, POST, PUT, PATCH, DELETE", enum=["GET", "POST", "PUT", "PATCH", "DELETE"])},
         ("path",)),
    Tool("api_get", "ERP dan o'qish",
         "GET so'rov foydalanuvchi nomidan, uning ruxsatlari bilan. Ro'yxatlar {items,total,page,size} qaytaradi.",
         api_get,
         {"path": _str("/api/v1/ dan keyingi yo'l, masalan 'projects/' yoki 'clients/12/'"),
          "params": {"type": "object", "description": "Query: q, page, size, sort, filtrlar",
                     "additionalProperties": True}},
         ("path",)),
    Tool("api_write", "ERP ga yozish",
         "POST/PUT/PATCH/DELETE foydalanuvchi nomidan. Har bir yozishdan oldin foydalanuvchidan aniq "
         "tasdiq oling. Maydonlarni describe_endpoint bilan tekshiring.", api_write,
         {"method": _str("Metod", enum=list(bridge.WRITE_METHODS)), "path": _str("/api/v1/ dan keyingi yo'l"),
          "body": {"type": "object", "description": "JSON tana", "additionalProperties": True}},
         ("method", "path"), write=True, read_only=False, destructive=True),
    Tool("project_context", "Loyiha konteksti",
         "openspec/project.md: tizim maqsadi, yo'l xaritasi, API qoidalari, lug'at.", project_context,
         page=Pages.SPECS),
    Tool("specs_list", "Spetsifikatsiyalar", "Barcha bo'limlar (capability) va faol o'zgarishlar ro'yxati.",
         specs_list, page=Pages.SPECS),
    Tool("spec_read", "Spetsifikatsiyani o'qish", "Bitta bo'limning to'liq spec.md matni (talablar va ssenariylar).",
         spec_read, {"capability": _str("Masalan 'procurement'")}, ("capability",), page=Pages.SPECS),
    Tool("specs_search", "Spetsifikatsiyada qidirish", "Hamma hujjatlardan so'z bo'yicha qidirish, mos qatorlar bilan.",
         specs_search,
         {"query": _str("So'zlar (hammasi bo'lishi kerak)"),
          "kind": _str("project | spec | change | archived", enum=DocKind.values),
          "limit": {"type": "integer", "minimum": 1, "maximum": 50}},
         ("query",), page=Pages.SPECS),
    Tool("changes_list", "O'zgarishlar", "Faol (yoki arxivlangan) OpenSpec o'zgarishlari.", changes_list,
         {"archived": {"type": "boolean", "description": "true = arxiv"}}, page=Pages.SPECS),
    Tool("change_read", "O'zgarishni o'qish", "O'zgarishning proposal, design, tasks va spec delta fayllari.",
         change_read, {"change": _str("Masalan 'add-claude-mcp' yoki '2026-10-31-add-mrp'")}, ("change",),
         page=Pages.SPECS),
    Tool("specs_check", "Spetsifikatsiya izchilligi",
         "Arxivlangan o'zgarishlar specs ga qo'shilganmi, har talabda ssenariy bormi — muammolar ro'yxati.",
         specs_check, page=Pages.SPECS),
    Tool("ideas_list", "Takliflar", "Tuzatish va yaxshilash takliflari (TK-…).", ideas_list,
         {"status": _str("Holat", enum=IdeaStatus.values), "capability": _str("Bo'lim"),
          "kind": _str("Turi", enum=IdeaKind.values), "q": _str("Qidiruv")}, page=Pages.FIX_IDEAS),
    Tool("idea_get", "Taklifni o'qish", "Bitta taklif to'liq.", idea_get, {"idea": _str("Kod (TK-0001) yoki id")},
         ("idea",), page=Pages.FIX_IDEAS),
    Tool("idea_create", "Taklif yozish",
         "Spec va tizimni solishtirib topilgan xato yoki g'oyani 'Takliflar' ga yozadi. Avval ideas_list bilan "
         "takrorlanmasligini tekshiring. Muammoga dalil keltiring.", idea_create, _IDEA_FIELDS, ("title", "problem"),
         page=Pages.FIX_IDEAS, action=Action.CREATE, read_only=False),
)
TOOLS_BY_NAME = {t.name: t for t in TOOLS}


def available(ctx: Context) -> list[Tool]:
    return [t for t in TOOLS if t.allowed(ctx)]


def run(ctx: Context, name: str, args: dict) -> tuple[str, bool]:
    """(text, is_error) for tools/call."""
    tool = TOOLS_BY_NAME.get(name)
    if tool is None or not tool.allowed(ctx):
        return f"'{name}' vositasi mavjud emas yoki ruxsat yo'q", True
    missing = [k for k in tool.required if args.get(k) in (None, "")]
    if missing:
        return f"Kerakli maydon: {', '.join(missing)}", True
    try:
        out = tool.handler(ctx, args)
    except ToolError as e:
        return str(e), True
    text = json.dumps(out, ensure_ascii=False, default=str)
    if len(text) > MAX_TEXT:
        text = text[:MAX_TEXT] + "\n…[qisqartirildi: size yoki filtr bilan toraytiring]"
    return text, False
