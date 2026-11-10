from django.db.models import Count
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.access.registry import Action, Pages
from apps.core.views import ServiceModelViewSet
from apps.specs import selectors, services
from apps.specs.models import FixIdea, SpecDocument
from apps.specs.serializers import (
    FixIdeaListSerializer,
    FixIdeaSerializer,
    IdeaStatusSerializer,
    SpecDocumentListSerializer,
    SpecDocumentSerializer,
)


class SpecDocumentViewSet(ServiceModelViewSet):
    """Read-only copy of `openspec/` (filled by `manage.py specs_sync`)."""

    page_key = Pages.SPECS
    http_method_names = ["get", "head", "options"]
    serializer_class = SpecDocumentSerializer
    list_serializer_class = SpecDocumentListSerializer
    filterset_fields = ["kind", "ref"]
    search_fields = ["path", "title", "content"]
    ordering_fields = ["path", "kind", "ref"]
    ordering = ["kind", "ref", "path"]
    permission_action_map = {"check": Action.VIEW, "summary": Action.VIEW}

    def get_queryset(self):
        qs = SpecDocument.objects.all()
        return qs.defer("content") if self.action == "list" else qs

    @action(detail=False, methods=["get"])
    def check(self, request):
        """OpenSpec consistency problems in the synced copy; empty = in sync."""
        return Response({"problems": selectors.db_problems()})

    @action(detail=False, methods=["get"])
    def summary(self, request):
        counts = dict(SpecDocument.objects.values_list("kind").annotate(n=Count("id")))
        last = SpecDocument.objects.order_by("-synced_at").values_list("synced_at", flat=True).first()
        return Response({"counts": counts, "synced_at": last, "capabilities": selectors.capabilities(),
                         "changes": selectors.changes()})


class FixIdeaViewSet(ServiceModelViewSet):
    page_key = Pages.FIX_IDEAS
    serializer_class = FixIdeaSerializer
    list_serializer_class = FixIdeaListSerializer
    filterset_fields = ["status", "kind", "priority", "capability", "source"]
    search_fields = ["code", "title", "problem", "proposal", "capability"]
    ordering_fields = ["code", "created_at", "priority", "status"]
    ordering = ["-created_at"]
    permission_action_map = {"change_status": Action.UPDATE, "proposal": Action.VIEW}

    service_create = services.idea_create
    service_update = services.idea_update
    service_delete = services.idea_delete

    def get_queryset(self):
        return FixIdea.objects.select_related("created_by")

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        s = IdeaStatusSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        idea = services.idea_change_status(self.get_object(), actor=request.user, **s.validated_data)
        return Response(FixIdeaSerializer(self._reload(idea)).data)

    @action(detail=True, methods=["get"])
    def proposal(self, request, pk=None):
        return Response({"markdown": selectors.idea_proposal_markdown(self.get_object())})
