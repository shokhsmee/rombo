from django.db.models import Count, Q
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Action, Pages
from apps.core.views import ServiceModelViewSet
from apps.konstruktor import services
from apps.konstruktor.models import Construction, ProfileSystem
from apps.konstruktor.serializers import (
    ConstructionSerializer,
    PreviewSerializer,
    SystemListSerializer,
    SystemSerializer,
    role_choices,
)
from apps.projects.models import Project


def _any_view(*pages):
    from apps.inventory.views import any_page_view

    return any_page_view(*pages)


class ProfileSystemViewSet(ServiceModelViewSet):
    page_key = Pages.PROFILE_SYSTEMS
    serializer_class = SystemSerializer
    list_serializer_class = SystemListSerializer
    filterset_fields = ["is_active", "price_list"]
    search_fields = ["name"]
    ordering = ["name"]

    service_create = services.system_create
    service_update = services.system_update
    service_delete = services.system_delete

    def get_permissions(self):
        if self.action in ("list", "retrieve"):  # the construction editor picks a system
            return [IsAuthenticated(), _any_view(Pages.PROFILE_SYSTEMS, Pages.CONSTRUCTIONS)()]
        return super().get_permissions()

    def get_queryset(self):
        return (ProfileSystem.objects.select_related("price_list", "product_type", "default_glass")
                .annotate(constructions_count=Count("constructions", filter=Q(constructions__deleted_at__isnull=True)))
                .prefetch_related("items__price_list_item"))

    @action(detail=False, methods=["get"])
    def roles(self, request):
        return Response(role_choices())


class ConstructionViewSet(ServiceModelViewSet):
    page_key = Pages.CONSTRUCTIONS
    serializer_class = ConstructionSerializer
    filterset_fields = ["project", "system"]
    search_fields = ["code", "name"]
    ordering = ["project_id", "sort_order", "id"]
    permission_action_map = {"duplicate": Action.CREATE, "preview": Action.VIEW}

    service_create = services.construction_create
    service_update = services.construction_update
    service_delete = services.construction_delete

    def get_queryset(self):
        return Construction.objects.select_related("system", "product_type", "project")

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        c = services.construction_duplicate(self.get_object(), actor=request.user)
        return Response(self.get_serializer(self._reload(c)).data, status=201)

    @action(detail=False, methods=["post"])
    def preview(self, request):
        s = PreviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(services.preview(**s.validated_data))


def _project(pk) -> Project:
    p = Project.objects.filter(pk=pk).first()
    if p is None:
        raise NotFound("Loyiha topilmadi")
    return p


@api_view(["GET"])
@permission_classes([IsAuthenticated, page_required(Pages.CONSTRUCTIONS)])
def project_summary_view(request, pk):
    return Response(services.project_summary(_project(pk)))


@api_view(["POST"])
@permission_classes([IsAuthenticated, page_required(Pages.CONSTRUCTIONS),
                     page_required(Pages.PROJECTS, Action.UPDATE)])
def fill_calc_view(request, pk):
    calcs = services.fill_calc(_project(pk), actor=request.user)
    return Response({"calcs": [{"id": c.pk, "title": c.title, "total": str(c.total)} for c in calcs]})
