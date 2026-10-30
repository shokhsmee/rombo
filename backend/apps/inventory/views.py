from decimal import Decimal

import django_filters
from django.db.models import Exists, OuterRef, Q
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.core.tabular import (
    Bulk,
    Col,
    Field,
    TabularMixin,
    as_date,
    as_decimal,
    choice,
    label_of,
    ref,
    workbook,
    xlsx_response,
)
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
from apps.projects.models import Project


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
            Exists(StockMove.all_objects.filter(to_warehouse=OuterRef("pk")))
        )
        return (
            Warehouse.objects.select_related("responsible")
            .annotate(has_moves=has)
            .order_by("-is_default", "name")
        )

    def get_permissions(self):
        if self.action in READ:
            return [
                IsAuthenticated(),
                any_page_view(Pages.WAREHOUSES, Pages.INVENTORY, Pages.STOCK, Pages.GOODS_RECEIPTS)(),
            ]
        return super().get_permissions()


# ------------------------------------------------------------------ products


class ProductFilter(django_filters.FilterSet):
    category = django_filters.MultipleChoiceFilter(choices=Category.choices)
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    warehouse = django_filters.NumberFilter(method="filter_noop")  # read by in_stock and the serializer

    class Meta:
        model = Product
        fields = ["category", "is_active", "unit", "in_stock", "warehouse"]

    def filter_noop(self, qs, name, value):
        return qs

    def filter_in_stock(self, qs, name, value):
        if value is None:
            return qs
        ids = selectors.products_in_stock(self.data.get("warehouse") or None)
        return qs.filter(pk__in=ids) if value else qs.exclude(pk__in=ids)


class ProductViewSet(TabularMixin, ServiceModelViewSet):
    page_key = Pages.PRODUCTS
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    search_fields = ["name", "sku", "code"]
    ordering_fields = ["name", "code", "category", "default_cost", "created_at"]
    ordering = ["name", "id"]

    service_create = services.product_create
    service_update = services.product_update
    service_delete = services.product_delete

    excel_name = "mahsulotlar"
    excel_columns = [
        Col("Kod", "code", width=12),
        Col("Nomi", "name", width=32),
        Col("Artikul", "sku", width=14),
        Col("Birlik", "unit", width=8),
        Col("Turkum", lambda p: label_of(Category)(p.category), width=16),
        Col("Standart tannarx", "default_cost", kind="money"),
        Col("Qoldiq", lambda p: selectors.product_totals(p)[0], kind="qty", width=12),
        Col("Qiymat, so'm", lambda p: selectors.product_totals(p)[1], kind="money"),
        Col("Faol", "is_active", width=8),
    ]
    excel_import = [
        Field("Nomi", "name", required=True),
        Field("Birlik", "unit", required=True, hint="m, m2, dona, kg"),
        Field(
            "Turkum",
            "category",
            resolve=choice(Category.choices),
            hint="Profil / Oyna / Furnitura / Boshqa material / Tayyor mahsulot",
        ),
        Field("Artikul", "sku"),
        Field("Standart tannarx", "default_cost", resolve=as_decimal),
        Field("Izoh", "notes"),
    ]
    bulk_actions = [
        Bulk(
            "deactivate",
            "Nofaol qilish",
            lambda p, *, actor: services.product_update(p, actor=actor, is_active=False),
        ),
        Bulk(
            "activate",
            "Faol qilish",
            lambda p, *, actor: services.product_update(p, actor=actor, is_active=True),
        ),
        Bulk("delete", "Arxivlash", services.product_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        return Product.objects.select_related("price_item")

    def get_permissions(self):
        if self.action in READ:  # the move form picks products
            return [
                IsAuthenticated(),
                any_page_view(
                    Pages.PRODUCTS,
                    Pages.INVENTORY,
                    Pages.STOCK,
                    Pages.PROCUREMENT,
                    Pages.PURCHASE_ORDERS,
                    Pages.GOODS_RECEIPTS,
                )(),
            ]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        rows = page if page is not None else list(qs)
        ctx = {**self.get_serializer_context(), "on_hand": selectors.products_on_hand(p.pk for p in rows)}
        wh = request.query_params.get("warehouse")
        if wh and wh.isdigit():
            ctx["in_warehouse"] = selectors.warehouse_products(int(wh), [p.pk for p in rows])
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
        fields = [
            "status",
            "type",
            "warehouse",
            "product",
            "category",
            "project",
            "partner",
            "source_model",
            "source_id",
        ]

    def filter_warehouse(self, qs, name, value):
        return qs.filter(Q(warehouse_id=value) | Q(to_warehouse_id=value))  # a transfer shows on both


class StockMoveViewSet(TabularMixin, ServiceModelViewSet):
    page_key = Pages.INVENTORY
    serializer_class = StockMoveSerializer
    list_serializer_class = StockMoveListSerializer
    filterset_class = StockMoveFilter
    search_fields = [
        "code",
        "product__name",
        "product__sku",
        "project__code",
        "project__name",
        "partner__name",
        "source_label",
        "notes",
    ]
    ordering_fields = ["date", "code", "qty", "amount", "status", "type", "created_at"]
    ordering = ["-date", "-id"]
    permission_action_map = {"post": Action.UPDATE, "cancel": Action.UPDATE}

    service_create = services.move_create
    service_update = services.move_update
    service_delete = services.move_delete

    excel_name = "ombor-harakatlari"
    excel_columns = [
        Col("№", "code", width=12),
        Col("Sana", "date", kind="date", width=12),
        Col("Turi", lambda m: label_of(MoveType)(m.type), width=16),
        Col("Holat", lambda m: label_of(MoveStatus)(m.status)),
        Col("Mahsulot kodi", "product.code", width=12),
        Col("Mahsulot", "product.name", width=30),
        Col("Turkum", lambda m: label_of(Category)(m.product.category), width=14),
        Col("Ombor", "warehouse.name"),
        Col("Qayerga", "to_warehouse.name"),
        Col("Miqdor", "qty", kind="qty", width=10),
        Col("Birlik", "product.unit", width=8),
        Col("Tannarx", "unit_cost", kind="money"),
        Col("Summa", "amount", kind="money"),
        Col("Loyiha", "project.code", width=14),
        Col("Kontragent", "partner.name", width=24),
        Col("Hujjat", "source_label", width=12),
        Col("O'tkazma", "entry.code", width=12),
        Col("Izoh", "notes", width=30),
    ]
    excel_import = [
        Field(
            "Turi",
            "type",
            required=True,
            resolve=choice([(k, v) for k, v in MoveType.choices if k != MoveType.RECEIPT]),
            hint="Chiqim / Ishlab chiqarish / Yetkazish / Ko'chirish / Tuzatish (boshlang'ich qoldiq — Tuzatish)",
        ),
        Field("Sana", "date", resolve=as_date, hint="31.10.2026; bo'sh — bugun"),
        Field(
            "Mahsulot",
            "product_id",
            required=True,
            resolve=ref(Product, "code", "sku", "name"),
            hint="kod (MH-00001), artikul yoki nomi",
        ),
        Field("Ombor", "warehouse_id", resolve=ref(Warehouse, "name"), hint="bo'sh — asosiy ombor"),
        Field("Qayerga", "to_warehouse_id", resolve=ref(Warehouse, "name"), hint="faqat ko'chirish uchun"),
        Field("Miqdor", "qty", required=True, resolve=as_decimal, hint="tuzatishda kamomad manfiy: -2"),
        Field("Tannarx", "unit_cost", resolve=as_decimal, hint="tuzatish (+) va ishlab chiqarish uchun"),
        Field(
            "Loyiha",
            "project_id",
            resolve=ref(Project, "code", "name"),
            hint="chiqim / ishlab chiqarish / yetkazish",
        ),
        Field("Izoh", "notes"),
    ]
    bulk_actions = [
        Bulk("post", "O'tkazish", services.move_post),
        Bulk("delete", "O'chirish (qoralama)", services.move_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        return StockMove.objects.select_related(
            "product", "warehouse", "to_warehouse", "project", "partner", "entry", "posted_by", "created_by"
        )

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
    data = selectors.stock(
        warehouse=d.get("warehouse"), category=d.get("category") or None, q=d["q"], nonzero=d["nonzero"]
    )
    if request.query_params.get("xlsx"):
        cats = dict(Category.choices)
        rows = [
            [
                r["product"]["code"],
                r["product"]["name"],
                cats.get(r["product"]["category"]),
                r["warehouse"]["name"],
                Decimal(r["qty"]),
                r["product"]["unit"],
                Decimal(r["avg_cost"]) if r["avg_cost"] else None,
                Decimal(r["value"]),
            ]
            for r in data["rows"]
        ]
        book = workbook(
            "qoldiqlar",
            ["Kod", "Mahsulot", "Turkum", "Ombor", "Miqdor", "Birlik", "O'rtacha tannarx", "Qiymat, so'm"],
            rows,
            ["", "", "", "", "qty", "", "money", "money"],
            [12, 32, 16, 18, 10, 8, 16, 16],
        )
        return xlsx_response(book, "qoldiqlar")
    return Response(data)
