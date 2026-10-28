from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Action, Pages
from apps.clients import services
from apps.clients.models import FINISHED_PROJECT_STATUSES, Client
from apps.clients.serializers import ClientListSerializer, ClientMapSerializer, ClientSerializer
from apps.core.views import ServiceModelViewSet


class ClientViewSet(ServiceModelViewSet):
    page_key = Pages.CLIENTS
    serializer_class = ClientSerializer
    list_serializer_class = ClientListSerializer
    filterset_fields = ["kind", "region", "is_active", "manager", "segment"]
    search_fields = ["code", "name", "tin", "contact_person", "phone", "phone_extra", "region"]
    ordering_fields = ["code", "name", "region", "created_at"]
    ordering = ["-created_at"]
    permission_action_map = {"map": Action.VIEW}

    service_create = services.client_create
    service_update = services.client_update
    service_delete = services.client_delete

    def get_queryset(self):
        qs = Client.objects.select_related("manager", "segment")
        if self.action not in ("list", "map"):
            qs = qs.annotate(projects_count=Count("projects", filter=Q(projects__deleted_at__isnull=True)))
        return qs

    # clients view (this viewset's page) + the map page itself
    @action(detail=False, methods=["get"], pagination_class=None,
            permission_classes=[*ServiceModelViewSet.permission_classes, page_required(Pages.CLIENT_MAP)])
    def map(self, request):
        """Every client with a point that matches the list filters; not paginated — the map needs them all."""
        qs = self.filter_queryset(self.get_queryset())
        has_point = Q(latitude__isnull=False, longitude__isnull=False)
        pins = qs.filter(has_point).annotate(active_projects=Count("projects", filter=Q(
            projects__deleted_at__isnull=True) & ~Q(projects__status__in=FINISHED_PROJECT_STATUSES)))
        items = ClientMapSerializer(pins, many=True).data
        return Response({"items": items, "total": len(items), "without_point": qs.exclude(has_point).count()})
