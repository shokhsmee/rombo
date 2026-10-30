import django_filters
from django.db.models import Exists, OuterRef, Q
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Action, Pages
from apps.core.views import ServiceModelViewSet
from apps.kassa import selectors, services
from apps.kassa.models import (
    CashAccount,
    CashOrder,
    OrderKind,
    OrderStatus,
    PaymentPurpose,
    PaymentRequest,
    PaymentRequestStatus,
)
from apps.kassa.serializers import (
    BookQuerySerializer,
    CancelSerializer,
    CashAccountSerializer,
    CashOrderListSerializer,
    CashOrderSerializer,
    DecisionSerializer,
    PaymentRequestListSerializer,
    PaymentRequestSerializer,
    PurposeSerializer,
)

# ------------------------------------------------------------------ accounts and purposes


class CashAccountViewSet(ServiceModelViewSet):
    """Kassa va bank. No delete: an account is deactivated (its orders and ledger lines stay)."""

    page_key = Pages.KASSA
    serializer_class = CashAccountSerializer
    pagination_class = None
    filterset_fields = ["kind", "currency", "is_active"]
    search_fields = ["name", "bank_name", "account_number"]
    ordering = ["-kind", "id"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    service_create = services.cash_account_create
    service_update = services.cash_account_update

    def get_queryset(self):
        has = Q(Exists(CashOrder.objects.filter(account=OuterRef("pk")))) | Q(
            Exists(CashOrder.objects.filter(to_account=OuterRef("pk"))))
        return (CashAccount.objects.select_related("account", "responsible")
                .annotate(has_orders=has).order_by("-kind", "id"))


class PurposeViewSet(ServiceModelViewSet):
    """Reading purposes needs the order page (the form lists them); editing them is kassa settings."""

    page_key = Pages.CASH_ORDERS
    serializer_class = PurposeSerializer
    pagination_class = None
    filterset_fields = ["direction", "posting", "is_active"]
    ordering = ["sort_order", "id"]
    queryset = PaymentPurpose.objects.all()

    service_create = services.purpose_create
    service_update = services.purpose_update
    service_delete = services.purpose_delete

    WRITE_ACTIONS = {"create": Action.CREATE, "update": Action.UPDATE, "partial_update": Action.UPDATE,
                     "destroy": Action.UPDATE}

    def get_permissions(self):
        write = self.WRITE_ACTIONS.get(self.action)
        if write is not None:
            return [IsAuthenticated(), page_required(Pages.KASSA, write)()]
        return super().get_permissions()


# ------------------------------------------------------------------ orders


class CashOrderFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=OrderStatus.choices)
    kind = django_filters.ChoiceFilter(choices=OrderKind.choices)
    account = django_filters.NumberFilter(method="filter_account")
    purpose = django_filters.NumberFilter(field_name="purpose_id")
    partner = django_filters.NumberFilter(field_name="partner_id")
    project = django_filters.NumberFilter(field_name="project_id")
    employee = django_filters.NumberFilter(field_name="employee_id")
    invoice = django_filters.NumberFilter(field_name="invoice_id")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = CashOrder
        fields = ["status", "kind", "account", "purpose", "partner", "project", "employee", "invoice", "currency"]

    def filter_account(self, qs, name, value):
        return qs.filter(Q(account_id=value) | Q(to_account_id=value))  # a transfer shows on both accounts


class CashOrderViewSet(ServiceModelViewSet):
    page_key = Pages.CASH_ORDERS
    serializer_class = CashOrderSerializer
    list_serializer_class = CashOrderListSerializer
    filterset_class = CashOrderFilter
    search_fields = ["code", "basis", "received_from", "issued_to", "partner__name", "project__code", "project__name",
                     "employee__last_name", "notes"]
    ordering_fields = ["date", "code", "amount", "status", "created_at"]
    ordering = ["-date", "-id"]
    permission_action_map = {"post": Action.UPDATE, "cancel": Action.UPDATE}

    service_create = services.cash_order_create
    service_update = services.cash_order_update
    service_delete = services.cash_order_delete

    def get_queryset(self):
        return CashOrder.objects.select_related("account__responsible", "to_account", "purpose", "partner", "project", "employee",
                                                "entry", "invoice", "posted_by", "created_by")

    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        order = services.cash_order_post(self.get_object(), actor=request.user)
        return Response(CashOrderSerializer(self._reload(order)).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = CancelSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = services.cash_order_cancel(self.get_object(), actor=request.user, **s.validated_data)
        return Response(CashOrderSerializer(self._reload(order)).data)


# ------------------------------------------------------------------ book and summary


@api_view(["GET"])
@permission_classes([IsAuthenticated, page_required(Pages.CASH_BOOK)])
def cash_book_view(request):
    s = BookQuerySerializer(data=request.query_params)
    s.is_valid(raise_exception=True)
    return Response(selectors.cash_book(s.validated_data["account"], s.validated_data["date"]))


@api_view(["GET"])
@permission_classes([IsAuthenticated, page_required(Pages.KASSA)])
def summary_view(request):
    return Response(selectors.summary())


# ------------------------------------------------------------------ money requests (ADR 0009)


class PaymentRequestFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=PaymentRequestStatus.choices)
    partner = django_filters.NumberFilter(field_name="partner_id")
    project = django_filters.NumberFilter(field_name="project_id")
    source_model = django_filters.CharFilter(field_name="source_model")
    source_id = django_filters.NumberFilter(field_name="source_id")
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = PaymentRequest
        fields = ["status", "partner", "project", "currency", "source_model", "source_id"]


PAY_APPROVER = [IsAuthenticated, page_required(Pages.PAYMENT_APPROVE, Action.UPDATE)]


class PaymentRequestViewSet(ServiceModelViewSet):
    page_key = Pages.PAYMENT_REQUESTS
    serializer_class = PaymentRequestSerializer
    list_serializer_class = PaymentRequestListSerializer
    filterset_class = PaymentRequestFilter
    search_fields = ["code", "basis", "partner__name", "project__code", "project__name", "source_label"]
    ordering_fields = ["code", "status", "amount", "needed_by", "created_at"]
    ordering = ["-created_at"]
    permission_action_map = {"submit": Action.UPDATE, "cancel": Action.UPDATE}

    service_create = services.payment_request_create
    service_update = services.payment_request_update
    service_delete = services.payment_request_delete

    def get_queryset(self):
        return PaymentRequest.objects.select_related("partner", "project", "purpose", "requested_by",
                                                     "decided_by")

    def _respond(self, req):
        return Response(PaymentRequestSerializer(self._reload(req)).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self._respond(services.payment_request_submit(self.get_object(), actor=request.user))

    @action(detail=True, methods=["post"], permission_classes=PAY_APPROVER)
    def approve(self, request, pk=None):
        s = DecisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.payment_request_approve(self.get_object(), actor=request.user,
                                                              **s.validated_data))

    @action(detail=True, methods=["post"], permission_classes=PAY_APPROVER)
    def reject(self, request, pk=None):
        s = DecisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.payment_request_reject(self.get_object(), actor=request.user,
                                                             **s.validated_data))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = DecisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._respond(services.payment_request_cancel(self.get_object(), actor=request.user,
                                                             **s.validated_data))
