import django_filters
from django.db.models import Exists, OuterRef, Q
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.core.views import ServiceModelViewSet
from apps.inventory import selectors, services
from apps.inventory.models import Category, MoveStatus, MoveType, Product, StockMove, Warehouse
from apps.inventory.serializers import (
    CancelSerializer,
    ProductSerializer,
    StockMoveListSerializer,
    StockMoveSerializer,
    StockQuerySerializer,
    WarehouseSerializer,
)



def any_page_view(*keys: str) -> type[BasePermission]:
    """Reading a list other pages pick from (the move form, the KR form, the stock page)."""

    class _AnyPage(BasePermission):
        message = "Bu amal uchun ruxsat yo'q"

        def has_permission(self, request, view):
            return any(has_permission(request.user, k, Action.VIEW) for k in keys)

    return _AnyPage


READ = ("list", "retrieve")

# ------------------------------------------------------------------ warehouses


class WarehouseViewSet(ServiceModelViewSet):
    """Reading the list needs any inventory page (the move form and stock page pick from it)."""

    page_key = Pages.WAREHOUSES
    serializer_class = WarehouseSerializer
    pagination_class = None
    filterset_fields = ["is_active"]
    search_fields = ["name", "address"]
    ordering = ["-is_default", "name"]

    service_create = services.warehouse_create
    service_update = services.warehouse_update
    service_delete = services.warehouse_delete

    def get_queryset(self):
        has = Q(Exists(StockMove.all_objects.filter(warehouse=OuterRef("pk")))) | Q(
            Exists(StockMove.all_objects.filter(to_warehouse=OuterRef("pk"))))
        return Warehouse.objects.select_related("responsible").annotate(has_moves=has).order_by("-is_default", "name")

    def get_permissions(self):
        if self.action in READ:
            return [IsAuthenticated(), any_page_view(Pages.WAREHOUSES, Pages.INVENTORY, Pages.STOCK,
                                                     Pages.GOODS_RECEIPTS)()]
        return super().get_permissions()


# ------------------------------------------------------------------ products


class ProductFilter(django_filters.FilterSet):
    category = django_filters.MultipleChoiceFilter(choices=Category.choices)

    class Meta:
        model = Product
        fields = ["category", "is_active", "unit"]


class ProductViewSet(ServiceModelViewSet):
    page_key = Pages.PRODUCTS
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    search_fields = ["name", "sku", "code"]
    ordering_fields = ["name", "code", "category", "default_cost", "created_at"]
    ordering = ["name", "id"]

    service_create = services.product_create
    service_update = services.product_update
    service_delete = services.product_delete

    def get_queryset(self):
        return Product.objects.select_related("price_item")

    def get_permissions(self):
        if self.action in READ:  # the move form picks products
            return [IsAuthenticated(), any_page_view(Pages.PRODUCTS, Pages.INVENTORY, Pages.STOCK)()]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        rows = page if page is not None else list(qs)
        ctx = {**self.get_serializer_context(), "on_hand": selectors.products_on_hand(p.pk for p in rows)}
        data = ProductSerializer(rows, many=True, context=ctx).data
        return self.get_paginated_response(data) if page is not None else Response(data)


# ------------------------------------------------------------------ moves


class StockMoveFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=MoveStatus.choices)
    type = django_filters.MultipleChoiceFilter(choices=MoveType.choices)
    warehouse = django_filters.NumberFilter(method="filter_warehouse")
    product = django_filters.NumberFilter(field_name="product_id")
    category = django_filters.ChoiceFilter(field_name="product__category", choices=Category.choices)
    project = django_filters.NumberFilter(field_name="project_id")
    partner = django_filters.NumberFilter(field_name="partner_id")
    source_model = django_filters.CharFilter(field_name="source_model")
    source_id = django_filters.NumberFilter(field_name="source_id")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = StockMove
        fields = ["status", "type", "warehouse", "product", "category", "project", "partner", "source_model",
                  "source_id"]

    def filter_warehouse(self, qs, name, value):
        return qs.filter(Q(warehouse_id=value) | Q(to_warehouse_id=value))  # a transfer shows on both


class StockMoveViewSet(ServiceModelViewSet):
    page_key = Pages.INVENTORY
    serializer_class = StockMoveSerializer
    list_serializer_class = StockMoveListSerializer
    filterset_class = StockMoveFilter
    search_fields = ["code", "product__name", "product__sku", "project__code", "project__name", "partner__name",
                     "source_label", "notes"]
    ordering_fields = ["date", "code", "qty", "amount", "status", "type", "created_at"]
    ordering = ["-date", "-id"]
    permission_action_map = {"post": Action.UPDATE, "cancel": Action.UPDATE}

    service_create = services.move_create
    service_update = services.move_update
    service_delete = services.move_delete

    def get_queryset(self):
        return StockMove.objects.select_related("product", "warehouse", "to_warehouse", "project", "partner", "entry",
                                                "posted_by", "created_by")

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        return qs.order_by(*qs.query.order_by, "-id")  # same-day rows: newest first, stable paging

    def _respond(self, m):
        return Response(StockMoveSerializer(self._reload(m)).data)

    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        return self._respond(services.move_post(self.get_object(), actor=request.user))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = CancelSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.move_cancel(self.get_object(), actor=request.user, **s.validated_data))

    @action(detail=False, methods=["get"])
    def summary(self, request):
        return Response(selectors.summary(self.filter_queryset(self.get_queryset())))


# ------------------------------------------------------------------ stock on hand


@api_view(["GET"])
@permission_classes([IsAuthenticated, page_required(Pages.STOCK)])
def stock_view(request):
    s = StockQuerySerializer(data=request.query_params)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    return Response(selectors.stock(warehouse=d.get("warehouse"), category=d.get("category") or None, q=d["q"],
                                    nonzero=d["nonzero"]))
