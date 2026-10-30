import django_filters
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import PagePermission, page_required
from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.core.tabular import Bulk, Col, Field, TabularMixin, as_decimal, choice, label_of, ref
from apps.core.views import ServiceModelViewSet
from apps.inventory.models import Product, Warehouse
from apps.mrp import selectors, services
from apps.mrp.models import Basis, Bom, BomLine
from apps.mrp.serializers import (
    BomLineImportSerializer,
    BomListSerializer,
    BomSerializer,
    FillCalcSerializer,
    MoveLinesSerializer,
    ItemProductSerializer,
    PlanQuerySerializer,
    ToIssueSerializer,
    ToRequestsSerializer,
)
from apps.projects.models import Project


def _bom_of(raw):
    """A BOM by its code (BM-00012) or by its product (code / name): the product's active BOM."""
    s = str(raw).strip()
    bom = Bom.objects.filter(code__iexact=s).first()
    if bom is None:
        pid = ref(Product, "code", "sku", "name")(raw)
        bom = Bom.objects.filter(product_id=pid, is_active=True).first()
    if bom is None:
        raise ValueError(f"«{s}» uchun faol tarkib yo'q — avval tarkibni oching")
    return bom.pk


class BomFilter(django_filters.FilterSet):
    product = django_filters.NumberFilter(field_name="product_id")
    component = django_filters.NumberFilter(field_name="lines__component_id")

    class Meta:
        model = Bom
        fields = ["product", "is_active", "component"]


class BomViewSet(TabularMixin, ServiceModelViewSet):
    page_key = Pages.BOM
    serializer_class = BomSerializer
    list_serializer_class = BomListSerializer
    filterset_class = BomFilter
    search_fields = ["code", "name", "product__name", "product__code"]
    ordering_fields = ["code", "name", "updated_at"]
    ordering = ["product__name", "-version"]

    service_create = services.bom_create
    service_update = services.bom_update
    service_delete = services.bom_delete

    excel_name = "tarkiblar"
    excel_columns = [
        Col("Kod", "code", width=12), Col("Mahsulot", "product.name", width=32), Col("Mahsulot kodi", "product.code"),
        Col("Nomi", "name", width=30), Col("Versiya", "version", width=8), Col("Faol", "is_active", width=8),
        Col("Tarkib", lambda b: "; ".join(f"{ln.component.name} {ln.qty.normalize():f}/{ln.basis}"
                                          for ln in b.lines.all()), width=80),
    ]
    bulk_actions = [
        Bulk("deactivate", "Nofaol qilish", lambda b, *, actor: services.bom_update(b, actor=actor, is_active=False)),
        Bulk("delete", "O'chirish", services.bom_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        qs = Bom.objects.select_related("product", "previous").distinct()
        if self.action == "list":
            return qs.annotate(lines_count=Count("lines", distinct=True))
        return qs.prefetch_related("lines__component")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):  # the product card and the Loyiha read BOMs
            return [IsAuthenticated(), _any_view(Pages.BOM, Pages.PRODUCTS, Pages.PROJECTS, Pages.MRP)()]
        return super().get_permissions()

    @action(detail=True, methods=["get"])
    def explode(self, request, pk=None):
        bom = self.get_object()
        count = request.query_params.get("count") or "1"
        area = request.query_params.get("area") or "1"
        need = selectors.explode(bom.product, as_decimal(count), as_decimal(area))
        products = {p.pk: p for p in Product.all_objects.filter(pk__in=need)}
        return Response([{"product": {"id": pid, "code": products[pid].code, "name": products[pid].name,
                                      "unit": products[pid].unit}, "qty": str(q)} for pid, q in need.items()])


def _any_view(*pages):
    from apps.inventory.views import any_page_view

    return any_page_view(*pages)


class BomLineViewSet(TabularMixin, ServiceModelViewSet):
    """BOM lines one by one — for the Excel import of many BOMs at once (the BOM page edits all lines)."""

    page_key = Pages.BOM
    serializer_class = BomLineImportSerializer
    filterset_fields = ["bom", "component"]
    ordering = ["bom_id", "sort_order", "id"]
    http_method_names = ["get", "post", "delete", "head", "options"]

    service_create = services.bomline_create
    service_delete = services.bomline_delete

    excel_name = "tarkib-qatorlari"
    excel_columns = [
        Col("Tarkib", "bom.code", width=12), Col("Mahsulot", "bom.product.name", width=30),
        Col("Material", "component.name", width=30), Col("Material kodi", "component.code"),
        Col("Miqdor", "qty", kind="qty", width=10), Col("Asos", lambda ln: label_of(Basis)(ln.basis), width=12),
        Col("Chiqindi, %", "waste_pct", width=10), Col("Izoh", "note", width=24),
    ]
    excel_import = [
        Field("Tarkib", "bom_id", required=True, resolve=_bom_of,
              hint="Tarkib kodi (BM-00001) yoki tayyor mahsulot kodi / nomi"),
        Field("Material", "component_id", required=True, resolve=ref(Product, "code", "sku", "name"),
              hint="Material kodi (MH-00001), artikuli yoki nomi"),
        Field("Miqdor", "qty", required=True, resolve=as_decimal),
        Field("Asos", "basis", resolve=choice([*Basis.choices, ("dona", "dona"), ("m2", "m²")]),
              hint="dona yoki m2 (1 m² ga)"),
        Field("Chiqindi, %", "waste_pct", resolve=as_decimal), Field("Izoh", "note"),
    ]

    def get_queryset(self):
        return BomLine.objects.select_related("bom__product", "component").filter(bom__deleted_at__isnull=True)


# ------------------------------------------------------------------ Loyiha materials


class ProjectMaterialsViewSet(viewsets.GenericViewSet):
    """/mrp/projects/{id}/… — the Loyiha's materials (add-project-materials)."""

    page_key = Pages.PROJECTS
    permission_classes = [IsAuthenticated, PagePermission]
    queryset = Project.objects.all()
    permission_action_map = {"materials": Action.VIEW, "item_product": Action.UPDATE, "freeze": Action.UPDATE,
                             "fill_calc": Action.UPDATE, "to_request": Action.VIEW, "to_issue": Action.VIEW,
                             "issue": Action.VIEW, "output": Action.VIEW, "deliver": Action.VIEW}

    def _need(self, page, act=Action.CREATE):
        if not has_permission(self.request.user, page, act):
            raise PermissionDenied("Bu amal uchun ruxsat yo'q")

    def _respond(self, project, **extra):
        wh = self.request.query_params.get("warehouse")
        if not wh and isinstance(self.request.data, dict):
            wh = self.request.data.get("warehouse_id")
        return Response({**selectors.materials(project, wh or None), **extra})

    def _one_step(self, request, fn):
        """Issue / output / deliver from the Loyiha card: create and post at once (inventory create + update)."""
        self._need(Pages.INVENTORY, Action.CREATE)
        self._need(Pages.INVENTORY, Action.UPDATE)
        s = MoveLinesSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        wid = s.validated_data.get("warehouse_id")
        project = self.get_object()
        warehouse = Warehouse.objects.filter(pk=wid).first() if wid else None
        result = fn(project, actor=request.user, warehouse=warehouse, lines=s.validated_data["lines"])
        return self._respond(project, result=result)

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        return self._one_step(request, services.issue)

    @action(detail=True, methods=["post"])
    def output(self, request, pk=None):
        return self._one_step(request, services.output)

    @action(detail=True, methods=["post"])
    def deliver(self, request, pk=None):
        return self._one_step(request, services.deliver)

    @action(detail=True, methods=["get"])
    def materials(self, request, pk=None):
        return self._respond(self.get_object())

    @action(detail=True, methods=["post"], url_path="item-product")
    def item_product(self, request, pk=None):
        s = ItemProductSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        project = self.get_object()
        services.item_product_set(project, actor=request.user, **s.validated_data)
        return self._respond(project)

    @action(detail=True, methods=["post"])
    def freeze(self, request, pk=None):
        project = self.get_object()
        services.materials_freeze(project, actor=request.user)
        return self._respond(project)

    @action(detail=True, methods=["post"], url_path="fill-calc")
    def fill_calc(self, request, pk=None):
        s = FillCalcSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        project = self.get_object()
        return self._respond(project, fill=services.fill_calc(project, actor=request.user, **s.validated_data))

    @action(detail=True, methods=["post"], url_path="to-request")
    def to_request(self, request, pk=None):
        self._need(Pages.PROCUREMENT)
        project = self.get_object()
        req = services.to_request(project, actor=request.user)
        return self._respond(project, request={"id": req.pk, "code": req.code})

    @action(detail=True, methods=["post"], url_path="to-issue")
    def to_issue(self, request, pk=None):
        self._need(Pages.INVENTORY)
        s = ToIssueSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        wid = s.validated_data.get("warehouse_id")
        project = self.get_object()
        moves = services.to_issue(project, actor=request.user,
                                  warehouse=Warehouse.objects.filter(pk=wid).first() if wid else None)
        return self._respond(project, moves=[m.pk for m in moves])


# ------------------------------------------------------------------ MRP plan


@api_view(["GET"])
@permission_classes([IsAuthenticated, page_required(Pages.MRP)])
def plan_view(request):
    s = PlanQuerySerializer(data=request.query_params)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    return Response(selectors.plan(project=d.get("project"), category=d.get("category") or None,
                                   deadline_before=d.get("deadline_before"), only_short=d["only_short"]))


@api_view(["POST"])
@permission_classes([IsAuthenticated, page_required(Pages.MRP), page_required(Pages.PROCUREMENT, Action.CREATE)])
def plan_to_requests_view(request):
    s = ToRequestsSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    reqs = services.plan_to_requests(actor=request.user, **s.validated_data)
    return Response({"requests": [{"id": r.pk, "code": r.code, "project": r.project.code} for r in reqs]})
