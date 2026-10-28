from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.access import services
from apps.access.registry import PAGES, Pages
from apps.access.selectors import role_queryset
from apps.access.serializers import PageSerializer, RoleListSerializer, RoleSerializer
from apps.core.views import ServiceModelViewSet


@api_view(["GET"])
def pages_view(request):
    """All pages with supported actions — the rows of the role matrix."""
    data = [{"key": p.key, "label": p.label, "group": p.group,
             "actions": [a.value for a in p.actions], "planned": p.planned} for p in PAGES]
    return Response(PageSerializer(data, many=True).data)


class RoleViewSet(ServiceModelViewSet):
    page_key = Pages.ROLES
    serializer_class = RoleSerializer
    list_serializer_class = RoleListSerializer
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    service_create = services.role_create
    service_update = services.role_update
    service_delete = services.role_delete

    def get_queryset(self):
        return role_queryset()
