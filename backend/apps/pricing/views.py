from django.db.models import Count
from rest_framework.permissions import IsAuthenticated

from apps.access.registry import Pages
from apps.core.views import ServiceModelViewSet
from apps.pricing import services
from apps.pricing.models import PriceList
from apps.pricing.serializers import PriceListListSerializer, PriceListSerializer


class PriceListViewSet(ServiceModelViewSet):
    page_key = Pages.PRICING
    serializer_class = PriceListSerializer
    list_serializer_class = PriceListListSerializer
    filterset_fields = ["is_active", "currency", "product_type"]
    search_fields = ["name"]
    ordering_fields = ["name"]
    ordering = ["name"]

    service_create = services.pricelist_create
    service_update = services.pricelist_update
    service_delete = services.pricelist_delete

    def get_permissions(self):
        # sales reads price lists to start a hisob-kitob; only the Narxlar page may change them
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        return (PriceList.objects.select_related("product_type")
                .annotate(items_count=Count("items")).prefetch_related("items"))
