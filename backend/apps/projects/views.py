import django_filters
from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.access.registry import Action, Pages
from apps.core.views import ServiceModelViewSet
from apps.projects import services
from apps.projects.models import FINISHED_STATUSES, Project, ProjectStatus
from apps.projects.serializers import (
    ProjectListSerializer,
    ProjectSerializer,
    StatusChangeSerializer,
    StatusSummarySerializer,
)


class ProjectFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=ProjectStatus.choices)  # ?status=a&status=b
    client = django_filters.NumberFilter(field_name="client_id")
    manager = django_filters.NumberFilter(field_name="manager_id")
    overdue = django_filters.BooleanFilter(method="filter_overdue")
    deadline_from = django_filters.DateFilter(field_name="deadline", lookup_expr="gte")
    deadline_to = django_filters.DateFilter(field_name="deadline", lookup_expr="lte")

    class Meta:
        model = Project
        fields = ["status", "client", "manager", "currency"]

    def filter_overdue(self, qs, name, value):
        if not value:
            return qs
        return qs.filter(deadline__lt=timezone.localdate()).exclude(status__in=FINISHED_STATUSES)


class ProjectViewSet(ServiceModelViewSet):
    page_key = Pages.PROJECTS
    serializer_class = ProjectSerializer
    list_serializer_class = ProjectListSerializer
    filterset_class = ProjectFilter
    # client name/phone searchable: sales usually look up an order by customer
    search_fields = ["code", "name", "contract_number", "object_address", "client__name", "client__phone"]
    ordering_fields = ["code", "name", "deadline", "amount", "status", "created_at"]
    ordering = ["-created_at"]
    permission_action_map = {"change_status": Action.UPDATE, "summary": Action.VIEW}

    service_create = services.project_create
    service_update = services.project_update
    service_delete = services.project_delete

    def get_queryset(self):
        return Project.objects.select_related("client", "manager")

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        s = StatusChangeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        project = services.project_change_status(self.get_object(), actor=request.user, **s.validated_data)
        return Response(ProjectSerializer(self._reload(project)).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        rows = Project.objects.values("status").annotate(count=Count("id")).order_by("status")
        return Response(StatusSummarySerializer(rows, many=True).data)
