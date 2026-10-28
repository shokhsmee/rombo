from rest_framework.permissions import IsAuthenticated

from apps.access.registry import Pages
from apps.core.views import ServiceModelViewSet
from apps.references import services
from apps.references.models import RefItem
from apps.references.serializers import RefItemSerializer


class RefItemViewSet(ServiceModelViewSet):
    page_key = Pages.REFERENCES
    serializer_class = RefItemSerializer
    filterset_fields = ["kind", "is_active"]
    search_fields = ["name"]
    ordering_fields = ["sort_order", "name"]
    ordering = ["kind", "sort_order", "name"]

    service_create = services.refitem_create
    service_update = services.refitem_update
    service_delete = services.refitem_delete

    def get_permissions(self):
        # every logged-in user reads the lists (they fill pickers on many pages); writes need the page
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        return RefItem.objects.all()
