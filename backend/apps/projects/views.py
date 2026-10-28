import django_filters
from django.db.models import Count, DecimalField, IntegerField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.access.registry import Action, Pages
from apps.core.views import ServiceModelViewSet
from apps.projects import services
from apps.projects.models import FINISHED_STATUSES, Project, ProjectFile, ProjectItem, ProjectStatus
from apps.projects.serializers import (
    FileUploadSerializer,
    ProjectFileSerializer,
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
        fields = ["status", "client", "manager", "partner", "sales_channel", "currency"]

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
    permission_action_map = {
        "change_status": Action.UPDATE, "summary": Action.VIEW,
        "files": Action.VIEW, "upload_file": Action.UPDATE, "download_file": Action.VIEW, "delete_file": Action.UPDATE,
    }
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    service_create = services.project_create
    service_update = services.project_update
    service_delete = services.project_delete

    def get_queryset(self):
        # totals via subqueries: two SUMs over one join would multiply each other
        lines = ProjectItem.objects.filter(project=OuterRef("pk")).values("project")
        qs = Project.objects.select_related("client", "manager").annotate(
            total_area=Coalesce(Subquery(lines.annotate(s=Sum("area_m2")).values("s")),
                                Value(0), output_field=DecimalField(max_digits=12, decimal_places=2)),
            total_quantity=Coalesce(Subquery(lines.annotate(s=Sum("quantity")).values("s")),
                                    Value(0), output_field=IntegerField()),
        )
        if self.action != "list":
            qs = qs.select_related("client__segment", "partner", "sales_channel", "brand").prefetch_related(
                "items__product_type", "files__uploaded_by")
        return qs

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        s = StatusChangeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        project = services.project_change_status(self.get_object(), actor=request.user, **s.validated_data)
        return Response(ProjectSerializer(self._reload(project)).data)

    # ---- drawings -------------------------------------------------------
    @action(detail=True, methods=["get"])
    def files(self, request, pk=None):
        return Response(ProjectFileSerializer(self.get_object().files.all(), many=True).data)

    @files.mapping.post
    def upload_file(self, request, pk=None):
        s = FileUploadSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        f = services.project_file_add(self.get_object(), actor=request.user, upload=s.validated_data["file"])
        return Response(ProjectFileSerializer(f).data, status=http.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path=r"files/(?P<file_id>\d+)")
    def download_file(self, request, pk=None, file_id=None):
        f = get_object_or_404(ProjectFile, pk=file_id, project=self.get_object())
        return FileResponse(f.file.open("rb"), as_attachment=True, filename=f.name)

    @download_file.mapping.delete
    def delete_file(self, request, pk=None, file_id=None):
        f = get_object_or_404(ProjectFile, pk=file_id, project=self.get_object())
        services.project_file_delete(f, actor=request.user)
        return Response(status=http.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        rows = Project.objects.values("status").annotate(count=Count("id")).order_by("status")
        return Response(StatusSummarySerializer(rows, many=True).data)
