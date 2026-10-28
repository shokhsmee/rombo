from django.db.models import Count, Q

from apps.access.registry import Pages
from apps.clients import services
from apps.clients.models import Client
from apps.clients.serializers import ClientListSerializer, ClientSerializer
from apps.core.views import ServiceModelViewSet


class ClientViewSet(ServiceModelViewSet):
    page_key = Pages.CLIENTS
    serializer_class = ClientSerializer
    list_serializer_class = ClientListSerializer
    filterset_fields = ["kind", "region", "is_active", "manager", "segment"]
    search_fields = ["code", "name", "tin", "contact_person", "phone", "phone_extra", "region"]
    ordering_fields = ["code", "name", "region", "created_at"]
    ordering = ["-created_at"]

    service_create = services.client_create
    service_update = services.client_update
    service_delete = services.client_delete

    def get_queryset(self):
        qs = Client.objects.select_related("manager", "segment")
        if self.action != "list":
            qs = qs.annotate(projects_count=Count("projects", filter=Q(projects__deleted_at__isnull=True)))
        return qs
