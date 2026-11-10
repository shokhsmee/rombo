"""MCP over Streamable HTTP, stateless subset: every POST carries one JSON-RPC message (or a batch) and gets a
JSON answer. No sessions, no server-initiated messages, so no SSE stream (GET → 405)."""

from __future__ import annotations

import logging

from django.conf import settings

from apps.mcp import tools

log = logging.getLogger(__name__)

SUPPORTED_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")
SERVER_INFO = {"name": "rombo-erp", "title": "Rombo ERP", "version": "1.0.0"}

PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS, INTERNAL_ERROR = -32700, -32600, -32601, -32602, -32603

INSTRUCTIONS = """\
Rombo ERP — deraza/eshik/fasad ishlab chiqaruvchi korxona tizimi. Siz foydalanuvchi NOMIDAN va uning
ruxsatlari bilan ishlaysiz: u brauzerda qila olmaydigan narsani siz ham qila olmaysiz.

Ish tartibi:
1. Ma'lumot: list_resources → kerakli yo'l → api_get. Ro'yxatlar {items,total,page,size};
   q (qidiruv), size (≤100), sort (-created_at), filtrlar params ichida.
2. Yozish (faqat "write" token): describe_endpoint bilan maydonlarni tekshiring, nima qilishingizni
   foydalanuvchiga aytib, ANIQ TASDIQ oling, keyin api_write. Xato javobi {"error": {code, message, field}}.
3. Tizim qanday ishlashi kerak: project_context, specs_list, spec_read, specs_search, change_read.
4. Tuzatish g'oyalari: spec talabini haqiqiy API javobi bilan solishtiring; farq topilsa ideas_list bilan
   takrorni tekshirib, idea_create bilan dalil bilan yozing (kod TK-…).

Lug'at: Loyiha = buyurtma (MJ-…), Mijoz = client, Xodim = employee, Xarid = procurement, Kirim = goods receipt,
Kassa = cash, Servis arizasi = service request (SV-…), Usta = master. Javobni foydalanuvchi tilida bering.
Summalar so'mda (UZS), agar boshqa valyuta ko'rsatilmagan bo'lsa.
"""


def _error(msg_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def _result(msg_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def handle(ctx: tools.Context, message) -> dict | None:
    """One JSON-RPC message → response dict, or None for notifications and client responses."""
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return _error(None, INVALID_REQUEST, "JSON-RPC 2.0 kutilgan")
    msg_id = message.get("id")
    method = message.get("method")
    if method is None:  # a response to something we never send
        return None
    if msg_id is None:  # notification (notifications/initialized, cancelled, …)
        return None
    params = message.get("params") or {}
    if not isinstance(params, dict):
        return _error(msg_id, INVALID_PARAMS, "params obyekt bo'lishi kerak")

    try:
        if method == "initialize":
            asked = params.get("protocolVersion")
            return _result(msg_id, {
                "protocolVersion": asked if asked in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0],
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO,
                "instructions": INSTRUCTIONS + _company_line(),
            })
        if method == "ping":
            return _result(msg_id, {})
        if method == "tools/list":
            return _result(msg_id, {"tools": [t.definition() for t in tools.available(ctx)]})
        if method == "tools/call":
            name = params.get("name")
            args = params.get("arguments") or {}
            if not isinstance(name, str) or not isinstance(args, dict):
                return _error(msg_id, INVALID_PARAMS, "name va arguments kerak")
            text, is_error = tools.run(ctx, name, args)
            return _result(msg_id, {"content": [{"type": "text", "text": text}], "isError": is_error})
        if method in ("resources/list", "prompts/list"):
            return _result(msg_id, {method.split("/")[0]: []})
        return _error(msg_id, METHOD_NOT_FOUND, f"Noma'lum metod: {method}")
    except Exception:
        log.exception("mcp %s", method)
        return _error(msg_id, INTERNAL_ERROR, "Server xatosi")


def _company_line() -> str:
    base = getattr(settings, "PUBLIC_BASE_URL", "")
    return f"\nERP manzili: {base}" if base else ""
