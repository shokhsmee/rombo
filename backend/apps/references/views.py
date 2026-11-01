from rest_framework.permissions import IsAuthenticated

from apps.access.registry import Pages
from apps.core.views import ServiceModelViewSet
from apps.references import services
from apps.references.models import RefItem, Uom
from apps.references.serializers import RefItemSerializer, UomSerializer


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


class UomViewSet(ServiceModelViewSet):
    """Sozlamalar → O'lchov birliklari. Read by every logged-in user (unit pickers), written with Ma'lumotnomalar."""

    page_key = Pages.REFERENCES
    serializer_class = UomSerializer
    pagination_class = None
    filterset_fields = ["category", "is_active"]
    search_fields = ["name", "aliases"]
    ordering = ["sort_order", "name"]

    service_create = services.uom_create
    service_update = services.uom_update
    service_delete = services.uom_delete

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        return Uom.objects.all()
