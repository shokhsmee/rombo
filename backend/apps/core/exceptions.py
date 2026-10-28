"""Domain errors + the single API error format.

Services raise DomainError subclasses (never DRF/HTTP exceptions), so business logic is
usable from management commands, Celery tasks and tests. Every error response has the shape:

    {"error": {"code": "...", "message": "...", "field": "name" | null, "fields": {...}}}
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions as drf_exc
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class DomainError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "domain_error"

    def __init__(self, message: str, *, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


class ValidationFailed(DomainError):
    code = "validation_failed"


class Conflict(DomainError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class NotFound(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


def _first_message(detail) -> str:
    if isinstance(detail, list):
        return _first_message(detail[0]) if detail else ""
    if isinstance(detail, dict):
        if "detail" in detail:
            return _first_message(detail["detail"])
        return _first_message(next(iter(detail.values()))) if detail else ""
    return str(detail)


def _flatten(detail, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    if isinstance(detail, dict):
        for key, value in detail.items():
            out.update(_flatten(value, f"{prefix}.{key}" if prefix else str(key)))
    elif isinstance(detail, list) and detail and isinstance(detail[0], dict | list):
        for i, value in enumerate(detail):
            out.update(_flatten(value, f"{prefix}.{i}"))
    else:
        out[prefix or "non_field_errors"] = _first_message(detail)
    return out


def exception_handler(exc, context):
    if isinstance(exc, DomainError):
        return Response(
            {"error": {"code": exc.code, "message": exc.message, "field": exc.field, "fields": {}}},
            status=exc.status_code,
        )

    # Django's own 404 / 403 (get_object_or_404, get_object) carry no .detail: use DRF's equivalents
    if isinstance(exc, Http404):
        exc = drf_exc.NotFound("Topilmadi")
    elif isinstance(exc, DjangoPermissionDenied):
        exc = drf_exc.PermissionDenied()

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, drf_exc.ValidationError):
        fields = _flatten(exc.detail)
        field = next(iter(fields), None)
        response.data = {
            "error": {
                "code": "validation_failed",
                "message": fields.get(field, "Ma'lumotlar noto'g'ri"),
                "field": None if field == "non_field_errors" else field,
                "fields": fields,
            }
        }
    else:
        code = getattr(exc, "default_code", "error")
        if isinstance(exc.detail, dict) and "code" in exc.detail:
            code = str(exc.detail["code"])
        response.data = {"error": {"code": code, "message": _first_message(exc.detail), "field": None,
                                   "fields": {}}}
    return response
