import django_filters
from django.db.models import Exists, OuterRef, Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework import status as http
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import PagePermission, page_required
from apps.access.registry import Action, Pages
from apps.accounting import selectors, services
from apps.accounting.models import (
    Account,
    AccountRole,
    ExchangeRate,
    Invoice,
    InvoiceKind,
    InvoiceStatus,
    JournalEntry,
    JournalLine,
)
from apps.accounting.serializers import (
    AccountCardQuerySerializer,
    AccountSerializer,
    CancelSerializer,
    EntryListSerializer,
    EntrySerializer,
    InvoiceListSerializer,
    InvoiceSerializer,
    ManualEntrySerializer,
    PeriodQuerySerializer,
    RateSerializer,
    ReconciliationQuerySerializer,
    ReverseSerializer,
    RoleSerializer,
)
from apps.clients.models import Client
from apps.core.views import ServiceModelViewSet
from apps.projects.models import Project

# ------------------------------------------------------------------ chart of accounts, roles, rates


class AccountViewSet(ServiceModelViewSet):
    """The whole chart in one list (no paging: ~100 rows, the page draws a tree)."""

    page_key = Pages.ACCOUNTS
    serializer_class = AccountSerializer
    pagination_class = None
    filterset_fields = ["kind", "is_active", "allow_posting", "parent"]
    search_fields = ["code", "name"]
    ordering = ["code"]

    service_create = services.account_create
    service_update = services.account_update
    service_delete = services.account_delete

    def get_queryset(self):
        return (Account.objects.annotate(has_lines=Exists(JournalLine.objects.filter(account=OuterRef("pk"))))
                .prefetch_related("roles").order_by("code"))


class RoleViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Role → account mapping. Only the account changes; keys are what the posting rules speak."""

    page_key = Pages.ACCOUNTS
    permission_classes = [IsAuthenticated, PagePermission]
    serializer_class = RoleSerializer
    pagination_class = None
    queryset = AccountRole.objects.select_related("account").order_by("key")

    def perform_update(self, serializer):
        role = services.role_set(serializer.instance, actor=self.request.user, **serializer.validated_data)
        serializer.instance = self.get_queryset().get(pk=role.pk)


class RateFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = ExchangeRate
        fields = ["currency", "date"]


class RateViewSet(ServiceModelViewSet):
    page_key = Pages.ACCOUNTS
    serializer_class = RateSerializer
    filterset_class = RateFilter
    ordering_fields = ["date", "rate"]
    ordering = ["-date"]
    queryset = ExchangeRate.objects.all()

    service_delete = services.rate_delete

    def perform_create(self, serializer):
        serializer.instance = services.rate_set(actor=self.request.user, **serializer.validated_data)

    def perform_update(self, serializer):
        row = serializer.instance
        data = {"date": row.date, "currency": row.currency, "rate": row.rate, **serializer.validated_data}
        if (data["date"], data["currency"]) != (row.date, row.currency):
            row.delete()  # a changed key is a different day's rate
        serializer.instance = services.rate_set(actor=self.request.user, **data)


# ------------------------------------------------------------------ journal


class EntryFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    account = django_filters.NumberFilter(method="filter_account")
    partner = django_filters.NumberFilter(field_name="lines__partner_id", distinct=True)
    project = django_filters.NumberFilter(field_name="lines__project_id", distinct=True)
    source_model = django_filters.CharFilter()

    class Meta:
        model = JournalEntry
        fields = ["status", "source_kind", "source_model", "source_id"]

    def filter_account(self, qs, name, value):
        return qs.filter(lines__account_id=value).distinct()


class EntryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                   viewsets.GenericViewSet):
    """Jurnal. Create = a manual entry (opening balances, corrections); there is no update or delete —
    PATCH answers 405, the way to change a posted entry is `reverse`."""

    page_key = Pages.ACCOUNTING
    permission_classes = [IsAuthenticated, PagePermission]
    serializer_class = EntrySerializer
    filterset_class = EntryFilter
    search_fields = ["code", "memo", "lines__memo"]
    ordering_fields = ["date", "code", "total_debit"]
    ordering = ["-date", "-id"]
    permission_action_map = {"reverse": Action.UPDATE}

    def get_queryset(self):
        qs = JournalEntry.objects.select_related("posted_by", "reversed_by")
        if self.action == "list":
            return qs
        return qs.select_related("reversal_of").prefetch_related(
            Prefetch("lines", JournalLine.objects.select_related("account", "partner", "project")))

    def get_serializer_class(self):
        return EntryListSerializer if self.action == "list" else EntrySerializer

    def _with_label(self, entry):
        entry.source_label = selectors.entry_source_label(entry)
        return entry

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        rows = [self._with_label(e) for e in page]
        return self.get_paginated_response(EntryListSerializer(rows, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return Response(EntrySerializer(self._with_label(self.get_object())).data)

    def create(self, request, *args, **kwargs):
        s = ManualEntrySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entry = services.entry_create_manual(actor=request.user, **s.validated_data)
        return Response(EntrySerializer(self._with_label(self.get_queryset().get(pk=entry.pk))).data,
                        status=http.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def reverse(self, request, pk=None):
        s = ReverseSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        mirror = services.entry_reverse(self.get_object(), actor=request.user, **s.validated_data)
        return Response(EntrySerializer(self._with_label(self.get_queryset().get(pk=mirror.pk))).data,
                        status=http.HTTP_201_CREATED)


# ------------------------------------------------------------------ invoices


class InvoiceFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=InvoiceStatus.choices)
    kind = django_filters.ChoiceFilter(choices=InvoiceKind.choices)
    partner = django_filters.NumberFilter(field_name="partner_id")
    project = django_filters.NumberFilter(field_name="project_id")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Invoice
        fields = ["status", "kind", "partner", "project", "currency"]


class InvoiceViewSet(ServiceModelViewSet):
    page_key = Pages.INVOICES
    serializer_class = InvoiceSerializer
    list_serializer_class = InvoiceListSerializer
    filterset_class = InvoiceFilter
    search_fields = ["code", "external_number", "partner__name", "project__code", "notes", "lines__name"]
    ordering_fields = ["date", "code", "gross", "status", "created_at"]
    ordering = ["-date", "-id"]
    permission_action_map = {"confirm": Action.UPDATE, "cancel": Action.UPDATE}

    service_create = services.invoice_create
    service_update = services.invoice_update
    service_delete = services.invoice_delete

    def get_queryset(self):
        qs = Invoice.objects.select_related("partner", "project", "entry")
        if self.action != "list":
            qs = qs.prefetch_related("lines")
        return qs.distinct() if self.action == "list" else qs

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        inv = services.invoice_confirm(self.get_object(), actor=request.user)
        return Response(InvoiceSerializer(self._reload(inv)).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = CancelSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        inv = services.invoice_cancel(self.get_object(), actor=request.user, **s.validated_data)
        return Response(InvoiceSerializer(self._reload(inv)).data)


# ------------------------------------------------------------------ reports and balances


def report_query(request, serializer_class):
    """?from=&to= plus the report's own keys → validated kwargs for the selector."""
    params = {k: v for k, v in request.query_params.items() if v != ""}
    params["date_from"], params["date_to"] = params.pop("from", None), params.pop("to", None)
    s = serializer_class(data=params)
    s.is_valid(raise_exception=True)
    return s.validated_data


class ReportsViewSet(viewsets.ViewSet):
    page_key = Pages.ACCOUNTING_REPORTS
    permission_classes = [IsAuthenticated, PagePermission]

    @action(detail=False, methods=["get"], url_path="trial-balance")
    def trial_balance(self, request):
        q = report_query(request, PeriodQuerySerializer)
        return Response(selectors.trial_balance(q["date_from"], q["date_to"]))

    @action(detail=False, methods=["get"], url_path="account-card")
    def account_card(self, request):
        q = report_query(request, AccountCardQuerySerializer)
        return Response(selectors.account_card(q["account"], q["date_from"], q["date_to"],
                                               partner=q["partner"], project=q["project"]))

    @action(detail=False, methods=["get"])
    def reconciliation(self, request):
        q = report_query(request, ReconciliationQuerySerializer)
        return Response(selectors.reconciliation(q["partner"], q["date_from"], q["date_to"]))


@api_view(["GET"])
@permission_classes([IsAuthenticated, page_required(Pages.CLIENTS)])
def partner_balance_view(request, pk: int):
    partner = get_object_or_404(Client, pk=pk)
    return Response(selectors.partner_balance(partner))


@api_view(["GET"])
@permission_classes([IsAuthenticated, page_required(Pages.PROJECTS)])
def project_money_view(request, pk: int):
    project = get_object_or_404(Project, pk=pk)
    return Response(selectors.project_money(project))


@api_view(["POST"])
@permission_classes([IsAuthenticated, page_required(Pages.INVOICES, Action.CREATE)])
def project_invoice_view(request, pk: int):
    """POST /projects/{id}/invoice/ — draft a customer invoice from the Loyiha (lives here so projects never
    imports accounting; config/urls.py mounts it under projects/)."""
    project = get_object_or_404(Project, pk=pk)
    inv = services.invoice_from_project(project, actor=request.user)
    inv = Invoice.objects.select_related("partner", "project", "entry").prefetch_related("lines").get(pk=inv.pk)
    return Response(InvoiceSerializer(inv).data, status=http.HTTP_201_CREATED)

