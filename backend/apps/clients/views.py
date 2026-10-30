from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Action, Pages
from apps.clients import services
from apps.clients.models import FINISHED_PROJECT_STATUSES, Client, ClientKind
from apps.clients.serializers import ClientListSerializer, ClientMapSerializer, ClientSerializer
from apps.core.tabular import Bulk, Col, Field, TabularMixin, choice, label_of
from apps.core.views import ServiceModelViewSet


class ClientViewSet(TabularMixin, ServiceModelViewSet):
    page_key = Pages.CLIENTS
    serializer_class = ClientSerializer
    list_serializer_class = ClientListSerializer
    filterset_fields = ["kind", "region", "is_active", "manager", "segment"]
    search_fields = ["code", "name", "tin", "contact_person", "phone", "phone_extra", "region"]
    ordering_fields = ["code", "name", "region", "created_at"]
    ordering = ["-created_at"]
    permission_action_map = {"map": Action.VIEW}

    service_create = services.client_create
    service_update = services.client_update
    service_delete = services.client_delete

    excel_name = "mijozlar"
    excel_columns = [
        Col("Kod", "code", width=12), Col("Turi", lambda c: label_of(ClientKind)(c.kind), width=14),
        Col("Nomi", "name", width=32), Col("STIR", "tin", width=14), Col("Telefon", "phone", width=16),
        Col("Qo'shimcha telefon", "phone_extra", width=16), Col("Email", "email", width=22),
        Col("Hudud", "region"), Col("Manzil", "address", width=30), Col("Qayerdan kelgan", "source"),
        Col("Menejer", "manager.name", width=22), Col("Segment", "segment.name"), Col("Faol", "is_active", width=8),
        Col("Yaratilgan", lambda c: c.created_at, kind="date", width=12),
    ]
    excel_import = [
        Field("Turi", "kind", resolve=choice([(k, v) for k, v in ClientKind.choices if k != ClientKind.SUPPLIER]),
              hint="Jismoniy shaxs / Yuridik shaxs; bo'sh — jismoniy"),
        Field("Nomi", "name", required=True, hint="F.I.O. yoki kompaniya nomi"),
        Field("STIR", "tin"), Field("Telefon", "phone", hint="+998901234567"),
        Field("Qo'shimcha telefon", "phone_extra"), Field("Email", "email"), Field("Hudud", "region"),
        Field("Manzil", "address"), Field("Qayerdan kelgan", "source"), Field("Pasport", "passport"),
        Field("Izoh", "notes"),
    ]
    bulk_actions = [
        Bulk("deactivate", "Nofaol qilish", lambda c, *, actor: services.client_update(c, actor=actor, is_active=False)),
        Bulk("activate", "Faol qilish", lambda c, *, actor: services.client_update(c, actor=actor, is_active=True)),
        Bulk("delete", "Arxivlash", services.client_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        qs = Client.objects.select_related("manager", "segment")
        if self.action in ("list", "map"):
            # suppliers live under Ta'minot (ADR 0008): the sales list shows them only when asked for
            if self.request.query_params.get("kind") != ClientKind.SUPPLIER:
                qs = qs.exclude(kind=ClientKind.SUPPLIER)
        else:
            qs = qs.annotate(projects_count=Count("projects", filter=Q(projects__deleted_at__isnull=True)))
        return qs

    # clients view (this viewset's page) + the map page itself
    @action(detail=False, methods=["get"], pagination_class=None,
            permission_classes=[*ServiceModelViewSet.permission_classes, page_required(Pages.CLIENT_MAP)])
    def map(self, request):
        """Every client with a point that matches the list filters; not paginated — the map needs them all."""
        qs = self.filter_queryset(self.get_queryset())
        has_point = Q(latitude__isnull=False, longitude__isnull=False)
        pins = qs.filter(has_point).annotate(active_projects=Count("projects", filter=Q(
            projects__deleted_at__isnull=True) & ~Q(projects__status__in=FINISHED_PROJECT_STATUSES)))
        items = ClientMapSerializer(pins, many=True).data
        return Response({"items": items, "total": len(items), "without_point": qs.exclude(has_point).count()})
