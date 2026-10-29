import django_filters
from django.db.models import Exists, OuterRef, Q
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Action, Pages
from apps.core.views import ServiceModelViewSet
from apps.kassa import selectors, services
from apps.kassa.models import CashAccount, CashOrder, OrderKind, OrderStatus, PaymentPurpose
from apps.kassa.serializers import (
    BookQuerySerializer,
    CancelSerializer,
    CashAccountSerializer,
    CashOrderListSerializer,
    CashOrderSerializer,
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
