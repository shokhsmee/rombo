from django.urls import re_path
from rest_framework.routers import SimpleRouter

from apps.mcp import views

router = SimpleRouter()
router.register("tokens", views.McpTokenViewSet, basename="mcp-token")

urlpatterns = router.urls

# Mounted at the root (config/urls.py) so the endpoint also answers without a trailing slash: a POST to
# /api/v1/mcp would otherwise be redirected, and MCP clients don't follow redirects with the body.
endpoint_urls = [
    re_path(r"^api/v1/mcp/?$", views.McpEndpoint.as_view(), name="mcp"),
    re_path(r"^api/v1/mcp/t/(?P<token>rmb_[\w-]+)/?$", views.McpEndpoint.as_view(), name="mcp-url-token"),
]
