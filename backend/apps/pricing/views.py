from django.db.models import Count
from rest_framework.permissions import IsAuthenticated

from apps.access.registry import Action, Pages
from apps.core.tabular import Bulk, Col, TabularMixin
from apps.core.views import ServiceModelViewSet
from apps.pricing import services
from apps.pricing.models import PriceList
from apps.pricing.serializers import PriceListListSerializer, PriceListSerializer


class PriceListViewSet(TabularMixin, ServiceModelViewSet):
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

    excel_name = "narxlar"
    excel_columns = [Col("Nomi", "name", width=36), Col("Valyuta", "currency", width=10),
                     Col("Profil uzunligi, m", "bar_length_m", kind="qty", width=12),
                     Col("Qatorlar", lambda p: p.items.count(), width=10), Col("Faol", "is_active", width=8)]
    bulk_actions = [Bulk("delete", "O'chirish", services.pricelist_delete, action=Action.DELETE, danger=True)]

    def get_permissions(self):
        # sales reads price lists to start a hisob-kitob; only the Narxlar page may change them
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        return (PriceList.objects.select_related("product_type")
                .annotate(items_count=Count("items")).prefetch_related("items"))
