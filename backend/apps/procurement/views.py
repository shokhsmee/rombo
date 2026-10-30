import django_filters
from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Action, Pages
from apps.clients import services as client_services
from apps.clients.models import Client, ClientKind
from apps.core.tabular import Bulk, Col, Field, TabularMixin, choice, label_of
from apps.core.views import ServiceModelViewSet
from apps.procurement import services
from apps.procurement.models import (
    ApprovalStep,
    GoodsReceipt,
    OrderStatus,
    PurchaseOrder,
    PurchaseRequest,
    ReceiptStatus,
    RequestStatus,
)
from apps.procurement.serializers import (
    ApprovalStepSerializer,
    CommentSerializer,
    FromCalcSerializer,
    FromProjectSerializer,
    FromRequestsSerializer,
    OrderListSerializer,
    OrderSerializer,
    ReceiptListSerializer,
    ReceiptSerializer,
    RequestListSerializer,
    RequestMoneySerializer,
    RequestSerializer,
    SendSerializer,
    SupplierSerializer,
)

# ------------------------------------------------------------------ purchase requests


class RequestFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=RequestStatus.choices)
    project = django_filters.NumberFilter(field_name="project_id")
    requester = django_filters.NumberFilter(field_name="requester_id")
    needs_approval = django_filters.BooleanFilter(method="filter_needs_approval")
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = PurchaseRequest
        fields = ["status", "project", "requester"]

    def filter_needs_approval(self, qs, name, value):
        return qs.filter(status=RequestStatus.SUBMITTED) if value else qs


APPROVER = [IsAuthenticated, page_required(Pages.PURCHASE_APPROVE, Action.UPDATE)]


class PurchaseRequestViewSet(TabularMixin, ServiceModelViewSet):
    page_key = Pages.PROCUREMENT
    serializer_class = RequestSerializer
    list_serializer_class = RequestListSerializer
    filterset_class = RequestFilter
    search_fields = ["code", "project__code", "project__name", "lines__name"]
    ordering_fields = ["code", "status", "needed_by", "created_at"]
    ordering = ["-created_at"]
    permission_action_map = {"submit": Action.UPDATE, "reopen": Action.UPDATE, "cancel": Action.UPDATE,
                             "from_calc": Action.UPDATE, "from_project": Action.CREATE,
                             "summary": Action.VIEW}

    service_create = services.request_create
    service_update = services.request_update
    service_delete = services.request_delete

    excel_name = "xarid-sorovlari"
    excel_columns = [
        Col("№", "code", width=12), Col("Holat", lambda r: label_of(RequestStatus)(r.status), width=20),
        Col("Loyiha", "project.code", width=14), Col("Loyiha nomi", "project.name", width=28),
        Col("So'rovchi", "requester.full_name", width=22), Col("Kerak sana", "needed_by", kind="date", width=12),
        Col("Qatorlar", lambda r: "; ".join(f"{ln.name} {ln.qty.normalize():f} {ln.unit}" for ln in r.lines.all()),
            width=60),
        Col("Yaratilgan", lambda r: r.created_at, kind="date", width=12),
    ]
    bulk_actions = [
        Bulk("submit", "Tasdiqlashga yuborish", services.request_submit),
        Bulk("approve", "Tasdiqlash", services.request_approve, page=Pages.PURCHASE_APPROVE),
        Bulk("cancel", "Bekor qilish", services.request_cancel, danger=True, comment=True),
        Bulk("delete", "O'chirish (qoralama)", services.request_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        qs = (PurchaseRequest.objects.select_related("project", "requester")
              .annotate(lines_count=Count("lines", distinct=True)))
        if self.action != "list":
            qs = (qs.select_related("approved_by", "approval_step__role")
                  .prefetch_related("lines__item", "lines__product", "approvals__user"))
        return qs

    def _respond(self, req, status=http.HTTP_200_OK):
        return Response(RequestSerializer(self._reload(req), context=self.get_serializer_context()).data,
                        status=status)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self._respond(services.request_submit(self.get_object(), actor=request.user))

    @action(detail=True, methods=["post"], permission_classes=APPROVER)
    def approve(self, request, pk=None):
        s = CommentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.request_approve(self.get_object(), actor=request.user,
                                                      **s.validated_data))

    @action(detail=True, methods=["post"], permission_classes=APPROVER)
    def reject(self, request, pk=None):
        s = CommentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.request_reject(self.get_object(), actor=request.user,
                                                     **s.validated_data))

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        return self._respond(services.request_reopen(self.get_object(), actor=request.user))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = CommentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.request_cancel(self.get_object(), actor=request.user,
                                                     **s.validated_data))

    @action(detail=True, methods=["post"], url_path="from-calc")
    def from_calc(self, request, pk=None):
        s = FromCalcSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.request_from_calc(self.get_object(), actor=request.user,
                                                        **s.validated_data))

    @action(detail=False, methods=["post"], url_path="from-project")
    def from_project(self, request):
        s = FromProjectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        req = services.request_from_project(actor=request.user, **s.validated_data)
        return self._respond(req, status=http.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        rows = PurchaseRequest.objects.values("status").annotate(count=Count("id")).order_by("status")
        return Response(list(rows))


# ------------------------------------------------------------------ purchase orders


class OrderFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=OrderStatus.choices)
    supplier = django_filters.NumberFilter(field_name="supplier_id")
    project = django_filters.NumberFilter(method="filter_project")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = PurchaseOrder
        fields = ["status", "supplier", "currency"]

    def filter_project(self, qs, name, value):
        # the header project is optional: a Loyiha's orders are the ones whose lines carry it
        return qs.filter(Q(project_id=value) | Q(lines__project_id=value)).distinct()


class PurchaseOrderViewSet(TabularMixin, ServiceModelViewSet):
    page_key = Pages.PURCHASE_ORDERS
    serializer_class = OrderSerializer
    list_serializer_class = OrderListSerializer
    filterset_class = OrderFilter
    search_fields = ["code", "supplier__name", "project__code", "project__name", "lines__project__code",
                     "lines__project__name", "lines__name"]
    ordering_fields = ["code", "status", "date", "expected_date", "created_at"]
    ordering = ["-created_at"]
    permission_action_map = {"send": Action.UPDATE, "cancel": Action.UPDATE, "from_requests": Action.CREATE,
                             "summary": Action.VIEW, "html": Action.VIEW, "request_money": Action.UPDATE}

    service_create = services.order_create
    service_update = services.order_update
    service_delete = services.order_delete

    excel_name = "buyurtmalar"
    excel_columns = [
        Col("№", "code", width=12), Col("Holat", lambda o: label_of(OrderStatus)(o.status), width=16),
        Col("Yetkazib beruvchi", "supplier.name", width=26), Col("Loyiha", "project.code", width=14),
        Col("Sana", "date", kind="date", width=12), Col("Kutilayotgan", "expected_date", kind="date", width=12),
        Col("Valyuta", "currency", width=8), Col("Kurs", "rate", kind="money", width=12),
        Col("Jami (valyuta)", lambda o: o.totals()["gross"], kind="money"),
        Col("Jami, so'm", lambda o: o.totals()["gross_uzs"], kind="money"),
        Col("Yuborilgan", lambda o: o.sent_at, kind="date", width=12),
    ]
    bulk_actions = [
        Bulk("cancel", "Bekor qilish", services.order_cancel, danger=True, comment=True),
        Bulk("delete", "O'chirish (qoralama)", services.order_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        qs = PurchaseOrder.objects.select_related("supplier", "project").prefetch_related("lines")
        if self.action != "list":
            qs = qs.select_related("sent_by", "payment_request").prefetch_related(
                "lines__project", "lines__product", "lines__request_line__request", "receipts")
        return qs

    def _respond(self, order):
        return Response(OrderSerializer(self._reload(order)).data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        s = SendSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.order_send(self.get_object(), actor=request.user, **s.validated_data))

    @action(detail=True, methods=["post"], url_path="request-money")
    def request_money(self, request, pk=None):
        s = RequestMoneySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.order_request_money(self.get_object(), actor=request.user,
                                                          **s.validated_data))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = CommentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.order_cancel(self.get_object(), actor=request.user, **s.validated_data))

    @action(detail=False, methods=["post"], url_path="from-requests")
    def from_requests(self, request):
        s = FromRequestsSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        orders = services.order_create_from_requests(actor=request.user, **s.validated_data)
        ids = [o.pk for o in orders]
        qs = self.get_queryset().filter(pk__in=ids)
        by_id = {o.pk: o for o in qs}
        return Response(OrderSerializer([by_id[i] for i in ids], many=True).data,
                        status=http.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def html(self, request, pk=None):
        """The order as the supplier receives it by email (also handy to check the template)."""
        return HttpResponse(services.order_email_html(self.get_object()))

    @action(detail=False, methods=["get"])
    def summary(self, request):
        rows = PurchaseOrder.objects.values("status").annotate(count=Count("id")).order_by("status")
        return Response(list(rows))


# ------------------------------------------------------------------ goods receipts


class ReceiptFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=ReceiptStatus.choices)
    supplier = django_filters.NumberFilter(field_name="supplier_id")
    order = django_filters.NumberFilter(field_name="order_id")
    project = django_filters.NumberFilter(method="filter_project")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = GoodsReceipt
        fields = ["status", "supplier", "order"]

    def filter_project(self, qs, name, value):
        return qs.filter(Q(order__project_id=value) | Q(lines__order_line__project_id=value)).distinct()


class GoodsReceiptViewSet(TabularMixin, ServiceModelViewSet):
    page_key = Pages.GOODS_RECEIPTS
    serializer_class = ReceiptSerializer
    list_serializer_class = ReceiptListSerializer
    filterset_class = ReceiptFilter
    search_fields = ["code", "order__code", "supplier__name", "invoice_number", "order__project__code",
                     "order__project__name", "lines__order_line__project__code", "lines__order_line__name"]
    ordering_fields = ["code", "status", "date", "created_at"]
    ordering = ["-created_at"]
    permission_action_map = {"post_receipt": Action.UPDATE, "cancel": Action.UPDATE, "summary": Action.VIEW}

    service_create = services.receipt_create_from_order
    service_update = services.receipt_update
    service_delete = services.receipt_delete

    excel_name = "kirimlar"
    excel_columns = [
        Col("№", "code", width=12), Col("Holat", lambda r: label_of(ReceiptStatus)(r.status), width=14),
        Col("Buyurtma", "order.code", width=12), Col("Yetkazib beruvchi", "supplier.name", width=26),
        Col("Sana", "date", kind="date", width=12), Col("Ombor", "warehouse.name", width=16),
        Col("Hisob-faktura №", "invoice_number", width=16),
        Col("Jami, so'm", lambda r: r.totals()["gross_uzs"], kind="money"),
    ]
    bulk_actions = [
        Bulk("post", "O'tkazish", services.receipt_post),
        Bulk("delete", "O'chirish (qoralama)", services.receipt_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        qs = (GoodsReceipt.objects.select_related("order", "supplier", "storekeeper", "warehouse")
              .prefetch_related("lines"))
        if self.action != "list":
            qs = qs.select_related("order__project",
                                   "posted_by", "entry").prefetch_related(
                "lines__order_line__project", "lines__product", "lines__order_line__product",
                "lines__order_line__item")
        return qs

    def _respond(self, receipt):
        return Response(ReceiptSerializer(self._reload(receipt)).data)

    @action(detail=True, methods=["post"], url_path="post")
    def post_receipt(self, request, pk=None):
        return self._respond(services.receipt_post(self.get_object(), actor=request.user))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = CommentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.receipt_cancel(self.get_object(), actor=request.user,
                                                     **s.validated_data))

    @action(detail=False, methods=["get"])
    def summary(self, request):
        rows = GoodsReceipt.objects.values("status").annotate(count=Count("id")).order_by("status")
        return Response(list(rows))


# ------------------------------------------------------------------ suppliers


def _supplier_create(*, actor, **fields) -> Client:
    return client_services.client_create(actor=actor, kind=ClientKind.SUPPLIER, **fields)


class SupplierViewSet(TabularMixin, ServiceModelViewSet):
    """Yetkazib beruvchilar: clients of kind supplier (ADR 0008) with their ledger balance."""

    page_key = Pages.SUPPLIERS
    serializer_class = SupplierSerializer
    filterset_fields = ["is_active", "region", "price_currency"]
    search_fields = ["code", "name", "tin", "contact_person", "phone", "phone_extra", "email", "region"]
    ordering_fields = ["code", "name", "region", "created_at"]
    ordering = ["name"]

    service_create = _supplier_create
    service_update = client_services.client_update
    service_delete = client_services.client_delete

    excel_name = "yetkazib-beruvchilar"
    excel_columns = [
        Col("Kod", "code", width=12), Col("Nomi", "name", width=30), Col("STIR", "tin", width=14),
        Col("Aloqa shaxsi", "contact_person", width=22), Col("Telefon", "phone", width=16), Col("Email", "email", width=22),
        Col("Hudud", "region"), Col("Manzil", "address", width=30), Col("Hisob raqami", "bank_account", width=24),
        Col("Bank", "bank_name", width=22), Col("MFO", "mfo", width=8), Col("Narx valyutasi", "price_currency", width=10),
        Col("Oldindan to'lov, %", "prepay_percent", width=10), Col("Kredit kunlari", "credit_days", width=10),
        Col("Faol", "is_active", width=8),
    ]
    excel_import = [
        Field("Nomi", "name", required=True), Field("STIR", "tin"), Field("Aloqa shaxsi", "contact_person"),
        Field("Telefon", "phone"), Field("Email", "email"), Field("Hudud", "region"), Field("Manzil", "address"),
        Field("Hisob raqami", "bank_account"), Field("Bank", "bank_name"), Field("MFO", "mfo"),
        Field("Narx valyutasi", "price_currency", resolve=choice([("UZS", "so'm"), ("USD", "USD")]), hint="UZS / USD"),
        Field("Oldindan to'lov, %", "prepay_percent"), Field("Kredit kunlari", "credit_days"), Field("Izoh", "notes"),
    ]
    bulk_actions = [
        Bulk("deactivate", "Nofaol qilish",
             lambda c, *, actor: client_services.client_update(c, actor=actor, is_active=False)),
        Bulk("activate", "Faol qilish", lambda c, *, actor: client_services.client_update(c, actor=actor, is_active=True)),
        Bulk("delete", "Arxivlash", client_services.client_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        return (Client.objects.filter(kind=ClientKind.SUPPLIER)
                .annotate(orders_count=Count("purchase_orders",
                                             filter=Q(purchase_orders__deleted_at__isnull=True),
                                             distinct=True)))


# ------------------------------------------------------------------ approval steps


class ApprovalStepViewSet(ServiceModelViewSet):
    """Sozlamalar → Tasdiqlash bosqichlari: ordered levels of request approval."""

    page_key = Pages.APPROVAL_STEPS
    serializer_class = ApprovalStepSerializer
    pagination_class = None
    filterset_fields = ["is_active", "role"]
    ordering = ["sequence", "id"]

    service_create = services.approval_step_create
    service_update = services.approval_step_update
    service_delete = services.approval_step_delete

    def get_queryset(self):
        return ApprovalStep.objects.select_related("role").order_by("sequence", "id")
