import json
from datetime import datetime, time, timedelta

import django_filters
from django.db.models import Q
from django.utils import timezone
from rest_framework import status as http
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.permissions import PagePermission
from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.core.exceptions import NotFound, ValidationFailed
from apps.core.views import ServiceModelViewSet
from apps.crm import selectors, services
from apps.crm.models import (
    LIVE_STATUSES,
    Call,
    CallDirection,
    CallStatus,
    Extension,
    Lead,
    LeadStatus,
    LeadTask,
    Pipeline,
    Stage,
    TelephonySettings,
)
from apps.crm.serializers import (
    CallSerializer,
    CallUpdateSerializer,
    ConvertSerializer,
    ExtensionSerializer,
    LeadListSerializer,
    LeadSerializer,
    MoveSerializer,
    PipelineSerializer,
    SoftphoneReportSerializer,
    StageSerializer,
    StageUpdateSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
    TelephonySettingsSerializer,
)

# ------------------------------------------------------------------ pipelines and stages


class PipelineViewSet(ServiceModelViewSet):
    page_key = Pages.CRM
    serializer_class = PipelineSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "head", "options"]  # a pipeline is deactivated, not deleted

    service_create = services.pipeline_create
    service_update = services.pipeline_update

    def get_queryset(self):
        services.default_pipeline()  # the first visit makes the default voronka
        return Pipeline.objects.prefetch_related("stages")


class StageViewSet(ServiceModelViewSet):
    page_key = Pages.CRM
    serializer_class = StageSerializer
    pagination_class = None
    filterset_fields = ["pipeline"]
    # stages are the voronka's setup: changing them is an `update` of the CRM page
    permission_action_map = {"create": Action.UPDATE, "destroy": Action.UPDATE}

    service_create = services.stage_create
    service_update = services.stage_update
    service_delete = services.stage_delete

    def get_queryset(self):
        return Stage.objects.all()

    def get_serializer_class(self):
        return StageUpdateSerializer if self.action in ("update", "partial_update") else StageSerializer


# ------------------------------------------------------------------ leads


class LeadFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=LeadStatus.choices)
    pipeline = django_filters.NumberFilter(field_name="pipeline_id")
    stage = django_filters.NumberFilter(field_name="stage_id")
    manager = django_filters.NumberFilter(field_name="manager_id")
    source = django_filters.NumberFilter(field_name="source_id")
    client = django_filters.NumberFilter(field_name="client_id")
    overdue = django_filters.BooleanFilter(method="filter_overdue")

    class Meta:
        model = Lead
        fields = ["status", "pipeline", "stage", "manager", "source", "client"]

    def filter_overdue(self, qs, name, value):
        if not value:
            return qs
        return qs.filter(tasks__done=False, tasks__due_at__lt=timezone.now()).distinct()


class LeadViewSet(ServiceModelViewSet):
    page_key = Pages.CRM
    serializer_class = LeadSerializer
    list_serializer_class = LeadListSerializer
    filterset_class = LeadFilter
    search_fields = ["code", "title", "contact_name", "phone", "client__name", "client__phone"]
    ordering_fields = ["code", "title", "budget", "created_at", "updated_at", "stage_changed_at"]
    ordering = ["-created_at"]
    permission_action_map = {"board": Action.VIEW, "move": Action.UPDATE, "convert": Action.UPDATE}

    service_create = services.lead_create
    service_update = services.lead_update
    service_delete = services.lead_delete

    def get_queryset(self):
        return selectors.leads_qs()

    @action(detail=False, methods=["get"])
    def board(self, request):
        pid = request.query_params.get("pipeline")
        p = Pipeline.objects.filter(pk=pid).first() if pid and pid.isdigit() else None
        p = p or services.default_pipeline()
        leads = selectors.board_leads(p, self.filter_queryset(self.get_queryset()))
        by_stage: dict[int, list] = {}
        for card in LeadListSerializer(leads, many=True).data:
            by_stage.setdefault(card["stage"]["id"], []).append(card)
        return Response({
            "pipeline": {"id": p.pk, "name": p.name},
            "stages": [{**StageSerializer(s).data, "leads": by_stage.get(s.pk, [])} for s in p.stages.all()],
        })

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        s = MoveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        lead = services.lead_move(self.get_object(), actor=request.user, **s.validated_data)
        return Response(LeadSerializer(self._reload(lead)).data)

    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        if not has_permission(request.user, Pages.PROJECTS, Action.CREATE):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Loyiha ochish uchun ruxsat yo'q")
        s = ConvertSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        lead = services.lead_convert(self.get_object(), actor=request.user, **s.validated_data)
        return Response(LeadSerializer(self._reload(lead)).data)


class TaskFilter(django_filters.FilterSet):
    lead = django_filters.NumberFilter(field_name="lead_id")
    assignee = django_filters.NumberFilter(field_name="assignee_id")
    mine = django_filters.BooleanFilter(method="filter_mine")
    overdue = django_filters.BooleanFilter(method="filter_overdue")

    class Meta:
        model = LeadTask
        fields = ["lead", "assignee", "done", "kind"]

    def filter_mine(self, qs, name, value):
        return qs.filter(assignee=self.request.user) if value else qs

    def filter_overdue(self, qs, name, value):
        return qs.filter(done=False, due_at__lt=timezone.now()) if value else qs


class TaskViewSet(ServiceModelViewSet):
    page_key = Pages.CRM
    serializer_class = TaskSerializer
    filterset_class = TaskFilter
    ordering_fields = ["due_at", "created_at"]
    ordering = ["done", "due_at", "id"]
    # a task is part of working the lead: adding or deleting one is an `update` of the CRM page
    permission_action_map = {"create": Action.UPDATE, "destroy": Action.UPDATE}

    service_create = services.task_create
    service_update = services.task_update
    service_delete = services.task_delete

    def get_queryset(self):
        return LeadTask.objects.filter(lead__deleted_at__isnull=True).select_related("lead", "assignee")

    def get_serializer_class(self):
        return TaskUpdateSerializer if self.action in ("update", "partial_update") else TaskSerializer


# ------------------------------------------------------------------ telephony


def _day(v: str | None, end: bool = False):
    if not v:
        return None
    try:
        d = datetime.strptime(v[:10], "%Y-%m-%d").date()
    except ValueError as e:
        raise ValidationFailed("Sana noto'g'ri (YYYY-MM-DD)") from e
    return timezone.make_aware(datetime.combine(d + timedelta(days=1) if end else d, time.min))


class CallFilter(django_filters.FilterSet):
    direction = django_filters.ChoiceFilter(choices=CallDirection.choices)
    status = django_filters.MultipleChoiceFilter(choices=CallStatus.choices)
    user = django_filters.NumberFilter(field_name="user_id")
    lead = django_filters.NumberFilter(field_name="lead_id")
    client = django_filters.NumberFilter(field_name="client_id")
    date_from = django_filters.CharFilter(method="filter_from")
    date_to = django_filters.CharFilter(method="filter_to")
    mine = django_filters.BooleanFilter(method="filter_mine")

    class Meta:
        model = Call
        fields = ["direction", "status", "user", "lead", "client"]

    def filter_from(self, qs, name, value):
        return qs.filter(started_at__gte=_day(value))

    def filter_to(self, qs, name, value):
        return qs.filter(started_at__lt=_day(value, end=True))

    def filter_mine(self, qs, name, value):
        return qs.filter(user=self.request.user) if value else qs


class CallViewSet(ServiceModelViewSet):
    page_key = Pages.TELEPHONY
    serializer_class = CallSerializer
    filterset_class = CallFilter
    search_fields = ["client_phone", "from_number", "to_number", "client__name", "lead__title", "note"]
    ordering_fields = ["started_at", "duration"]
    ordering = ["-started_at", "-id"]
    http_method_names = ["get", "post", "patch", "head", "options"]  # calls come from the PBX
    permission_action_map = {"live": Action.VIEW, "stats": Action.VIEW, "create_lead": Action.UPDATE}

    def get_queryset(self):
        return selectors.calls_qs()

    def list(self, request, *args, **kwargs):
        services.expire_stale()
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        raise NotFound("Qo'ng'iroqlar PBX yoki brauzer telefonidan keladi")

    def partial_update(self, request, *args, **kwargs):
        s = CallUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        call = services.call_update(self.get_object(), actor=request.user, **s.validated_data)
        return Response(CallSerializer(self._reload(call)).data)

    @action(detail=True, methods=["post"], url_path="lead")
    def create_lead(self, request, pk=None):
        if not has_permission(request.user, Pages.CRM, Action.CREATE):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Lid yaratish uchun ruxsat yo'q")
        call = services.call_create_lead(self.get_object(), actor=request.user)
        return Response(CallSerializer(self._reload(call)).data)

    @action(detail=False, methods=["get"])
    def live(self, request):
        """The operator's calls now and just ended (the popup polls this)."""
        services.expire_stale()
        recent = timezone.now() - timedelta(minutes=2)
        qs = selectors.calls_qs().filter(user=request.user).exclude(direction=CallDirection.INTERNAL).filter(
            Q(status__in=LIVE_STATUSES) | Q(ended_at__gte=recent))[:5]
        return Response(CallSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        today = timezone.localdate().isoformat()
        since = _day(request.query_params.get("date_from") or today)
        until = _day(request.query_params.get("date_to") or today, end=True)
        mine = request.query_params.get("mine") in ("1", "true")
        return Response(selectors.call_stats(since, until, request.user if mine else None))


class ExtensionViewSet(ServiceModelViewSet):
    page_key = Pages.TELEPHONY
    serializer_class = ExtensionSerializer
    pagination_class = None
    # who rings where is telephony setup: every write is an `update` of the page
    permission_action_map = {"create": Action.UPDATE, "destroy": Action.UPDATE}

    service_create = services.extension_create
    service_update = services.extension_update
    service_delete = services.extension_delete

    def get_queryset(self):
        return Extension.objects.select_related("user")


class TelephonySettingsView(APIView):
    """GET / PATCH the one settings row; POST rotate-token issues a new webhook URL."""

    permission_classes = [IsAuthenticated, PagePermission]
    page_key = Pages.TELEPHONY
    permission_action_map = {"get": Action.VIEW, "patch": Action.UPDATE, "post": Action.UPDATE}

    def initial(self, request, *args, **kwargs):
        self.action = request.method.lower()  # PagePermission reads view.action
        super().initial(request, *args, **kwargs)

    def _out(self, request, st: TelephonySettings):
        data = TelephonySettingsSerializer(st).data
        if not has_permission(request.user, Pages.TELEPHONY, Action.UPDATE):
            data["webhook_token"] = ""  # the token is the webhook's password
        return Response(data)

    def get(self, request):
        return self._out(request, services.telephony_settings())

    def patch(self, request):
        s = TelephonySettingsSerializer(services.telephony_settings(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        return self._out(request, services.telephony_settings_update(actor=request.user, **s.validated_data))

    def post(self, request):  # /settings/rotate-token/
        return self._out(request, services.telephony_rotate_token(actor=request.user))


class MyPhoneView(APIView):
    """The current user's extension and browser-phone settings; the softphone reports its calls here."""

    permission_classes = [IsAuthenticated, PagePermission]
    page_key = Pages.TELEPHONY
    permission_action_map = {"get": Action.VIEW, "post": Action.VIEW}

    def initial(self, request, *args, **kwargs):
        self.action = request.method.lower()
        super().initial(request, *args, **kwargs)

    def get(self, request):
        st = services.telephony_settings()
        return Response({"enabled": st.enabled, "phone": selectors.softphone_config(request.user, st)})

    def post(self, request):  # /softphone/
        s = SoftphoneReportSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        call = services.softphone_report(actor=request.user, data=s.validated_data)
        return Response({"id": call.pk if call else None}, status=http.HTTP_200_OK)


MAX_EVENTS_PER_REQUEST = 50  # the link is public: one request can't make an unbounded number of calls


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def telephony_hook(request, token: str):
    """PBX events. The random token in the settings row is the access; JSON object, list, or a form post."""
    st = TelephonySettings.objects.filter(pk=1, webhook_token=token, enabled=True).first()
    if st is None:
        raise NotFound("Not found")
    body = request.data
    if isinstance(body, bytes | str):
        try:
            body = json.loads(body or "{}")
        except ValueError as e:
            raise ValidationFailed("JSON xato") from e
    if hasattr(body, "dict"):  # a QueryDict from a form post
        body = body.dict()
    items = [x for x in body if isinstance(x, dict)] if isinstance(body, list) else [body]
    calls = [c for p in items[:MAX_EVENTS_PER_REQUEST] if (c := services.ingest(dict(p)))]
    return Response({"ok": True, "calls": [c.pk for c in calls]})
