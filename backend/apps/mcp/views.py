import json

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.core.views import ServiceModelViewSet
from apps.mcp import protocol, services
from apps.mcp.models import McpToken
from apps.mcp.serializers import McpTokenCreateSerializer, McpTokenSerializer
from apps.mcp.tools import Context

MAX_BODY = 1_000_000


def endpoint_url(request) -> str:
    base = settings.PUBLIC_BASE_URL or request.build_absolute_uri("/").rstrip("/")
    return f"{base}/api/v1/mcp/"


def _deny(status: int, message: str) -> JsonResponse:
    resp = JsonResponse({"error": {"code": "unauthorized" if status == 401 else "forbidden", "message": message,
                                   "field": None, "fields": {}}}, status=status)
    if status == 401:
        resp["WWW-Authenticate"] = 'Bearer realm="rombo-erp", error="invalid_token"'
    return resp


@method_decorator(csrf_exempt, name="dispatch")
class McpEndpoint(View):
    """POST /api/v1/mcp/ (Authorization: Bearer rmb_…) or /api/v1/mcp/t/<token>/ (claude.ai connectors)."""

    http_method_names = ["post", "options"]

    def post(self, request, token: str | None = None):
        secret = token
        if secret is None:
            scheme, _, value = request.headers.get("Authorization", "").partition(" ")
            secret = value.strip() if scheme.lower() == "bearer" else ""
        tok = services.token_authenticate(secret)
        if tok is None:
            return _deny(401, "MCP token noto'g'ri yoki muddati o'tgan")
        if not has_permission(tok.user, Pages.MCP, Action.VIEW):
            return _deny(403, "Claude (MCP) uchun ruxsat yo'q")
        request.user = tok.user  # chatter tracking names the real author

        if len(request.body) > MAX_BODY:
            return JsonResponse(protocol._error(None, protocol.INVALID_REQUEST, "So'rov juda katta"), status=413)
        try:
            payload = json.loads(request.body or b"null")
        except ValueError:
            return JsonResponse(protocol._error(None, protocol.PARSE_ERROR, "JSON xato"), status=400)

        ctx = Context(token=tok, origin=request)
        if isinstance(payload, list):
            if not payload:
                return JsonResponse(protocol._error(None, protocol.INVALID_REQUEST, "Bo'sh batch"), status=400)
            answers = [a for a in (protocol.handle(ctx, m) for m in payload) if a is not None]
            return JsonResponse(answers, safe=False) if answers else HttpResponse(status=202)
        answer = protocol.handle(ctx, payload)
        return JsonResponse(answer) if answer is not None else HttpResponse(status=202)


class McpTokenViewSet(ServiceModelViewSet):
    """The current user's own MCP tokens. Create shows the secret once; delete revokes."""

    page_key = Pages.MCP
    http_method_names = ["get", "post", "delete", "head", "options"]
    serializer_class = McpTokenSerializer
    ordering = ["-created_at"]
    permission_action_map = {"info": Action.VIEW}

    def get_queryset(self):
        return McpToken.objects.filter(user=self.request.user, revoked_at__isnull=True)

    def create(self, request, *args, **kwargs):
        s = McpTokenCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        token, secret = services.token_issue(actor=request.user, **s.validated_data)
        url = endpoint_url(request)
        return Response({**McpTokenSerializer(token).data, "token": secret, "endpoint": url,
                         "connector_url": f"{url}t/{secret}/"}, status=http.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        services.token_revoke(instance, actor=self.request.user)

    @action(detail=False, methods=["get"])
    def info(self, request):
        return Response({"endpoint": endpoint_url(request), "server_name": protocol.SERVER_INFO["name"],
                         "protocol_versions": list(protocol.SUPPORTED_VERSIONS)})
