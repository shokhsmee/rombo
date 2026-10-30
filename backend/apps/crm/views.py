import json
from datetime import datetime, time, timedelta

import django_filters
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, StreamingHttpResponse
from django.utils import timezone
from rest_framework import status as http
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.permissions import PagePermission
from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.core.exceptions import NotFound, ValidationFailed
from apps.core.tabular import Col, TabularMixin, label_of
from apps.core.views import ServiceModelViewSet
from apps.crm import analytics, catalog, selectors, services
from apps.crm.models import (
    LIVE_STATUSES,
    Call,
    CallDirection,
    CallStatus,
    Connection,
    Extension,
    Lead,
    LeadField,
    LeadStatus,
    LeadTask,
    LostReason,
    Pipeline,
    Stage,
)
from apps.crm.providers.http import ProviderError
from apps.crm.serializers import (
    BulkSerializer,
    CallSerializer,
    CallUpdateSerializer,
    ConnectionSerializer,
    ConnectionWriteSerializer,
    ConvertSerializer,
    CrmSettingsSerializer,
    DialSerializer,
    ExtensionSerializer,
    LeadFieldSerializer,
    LeadFieldUpdateSerializer,
    LeadListSerializer,
    LeadSerializer,
    LostReasonSerializer,
    MergeSerializer,
    MoveSerializer,
    OrderSerializer,
    PipelineSerializer,
    SoftphoneReportSerializer,
    StageSerializer,
    StageUpdateSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
    TelephonySettingsSerializer,
    TextSerializer,
)


def _need(request, page: str, act: Action, message: str = "Bu amal uchun ruxsat yo'q") -> None:
    if not has_permission(request.user, page, act):
        raise PermissionDenied(message)


def _day(v: str | None, end: bool = False):
    if not v:
        return None
    try:
        d = datetime.strptime(v[:10], "%Y-%m-%d").date()
    except ValueError as e:
        raise ValidationFailed("Sana noto'g'ri (YYYY-MM-DD)") from e
    return timezone.make_aware(datetime.combine(d + timedelta(days=1) if end else d, time.min))


def _period(request, default_days: int = 30):
    """[from, to) from ?date_from&date_to (days), the last 30 days by default, never past tomorrow."""
    today = timezone.localdate()
    since = _day(request.query_params.get("date_from") or (today - timedelta(days=default_days - 1)).isoformat())
    until = min(_day(request.query_params.get("date_to") or today.isoformat(), end=True),
                _day(today.isoformat(), end=True))
    if until <= since:
        raise ValidationFailed("Davr noto'g'ri", field="date_from")
    return since, until


class OneRowView(APIView):
    """GET / PATCH of a settings row; the action for PagePermission is the HTTP method."""

    permission_classes = [IsAuthenticated, PagePermission]
    permission_action_map = {"get": Action.VIEW, "patch": Action.UPDATE, "post": Action.UPDATE,
                             "delete": Action.UPDATE}

    def initial(self, request, *args, **kwargs):
        self.action = request.method.lower()  # PagePermission reads view.action
        super().initial(request, *args, **kwargs)


# ------------------------------------------------------------------ pipelines, stages, settings


class PipelineViewSet(ServiceModelViewSet):
    page_key = Pages.CRM
    serializer_class = PipelineSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "head", "options"]  # a pipeline is archived, not deleted
    permission_action_map = {"create": Action.UPDATE, "partial_update": Action.UPDATE, "update": Action.UPDATE,
                             "order": Action.UPDATE, "lost_reasons": Action.UPDATE}

    service_create = services.pipeline_create
    service_update = services.pipeline_update

    def get_queryset(self):
        services.default_pipeline()  # the first visit makes the default voronka
        return Pipeline.objects.prefetch_related("stages", "lost_reasons")

    @action(detail=True, methods=["post"])
    def order(self, request, pk=None):
        s = OrderSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.stages_reorder(self.get_object(), actor=request.user, ids=s.validated_data["ids"])
        return Response(PipelineSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"], url_path="lost-reasons")
    def lost_reasons(self, request, pk=None):
        s = TextSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        r = services.lost_reason_create(actor=request.user, pipeline=self.get_object(), text=s.validated_data["text"])
        return Response(LostReasonSerializer(r).data, status=http.HTTP_201_CREATED)


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


class LostReasonViewSet(ServiceModelViewSet):
    page_key = Pages.CRM
    serializer_class = LostReasonSerializer
    pagination_class = None
    http_method_names = ["delete", "options"]
    permission_action_map = {"destroy": Action.UPDATE}
    service_delete = services.lost_reason_delete

    def get_queryset(self):
        return LostReason.objects.all()


class LeadFieldViewSet(ServiceModelViewSet):
    page_key = Pages.CRM
    serializer_class = LeadFieldSerializer
    pagination_class = None
    permission_action_map = {"create": Action.UPDATE, "destroy": Action.UPDATE}

    service_create = services.field_create
    service_update = services.field_update
    service_delete = services.field_delete

    def get_queryset(self):
        return LeadField.objects.all()

    def get_serializer_class(self):
        return LeadFieldUpdateSerializer if self.action in ("update", "partial_update") else LeadFieldSerializer


class CrmSettingsView(OneRowView):
    page_key = Pages.CRM

    def get(self, request):
        emp = getattr(request.user, "employee", None)  # the board's «Meniki» compares managers (employees)
        return Response({**CrmSettingsSerializer(services.crm_settings()).data, "me_employee": emp.pk if emp else None})

    def patch(self, request):
        s = CrmSettingsSerializer(services.crm_settings(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        return Response(CrmSettingsSerializer(services.crm_settings_update(actor=request.user,
                                                                           **s.validated_data)).data)


class CrmAnalyticsView(OneRowView):
    page_key = Pages.CRM

    def get(self, request):
        since, until = _period(request)
        pid = request.query_params.get("pipeline")
        p = Pipeline.objects.filter(pk=pid).first() if pid and pid.isdigit() else None
        manager = request.query_params.get("manager")
        return Response(analytics.crm_analytics(since, until, p or services.default_pipeline(),
                                                int(manager) if manager and manager.isdigit() else None))


# ------------------------------------------------------------------ leads


class LeadFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=LeadStatus.choices)
    pipeline = django_filters.NumberFilter(field_name="pipeline_id")
    stage = django_filters.NumberFilter(field_name="stage_id")
    manager = django_filters.NumberFilter(field_name="manager_id")
    source = django_filters.NumberFilter(field_name="source_id")
    client = django_filters.NumberFilter(field_name="client_id")
    overdue = django_filters.BooleanFilter(method="filter_overdue")
    created_from = django_filters.DateFilter(field_name="created_at__date", lookup_expr="gte")
    created_to = django_filters.DateFilter(field_name="created_at__date", lookup_expr="lte")

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
    permission_action_map = {"board": Action.VIEW, "move": Action.UPDATE, "convert": Action.UPDATE,
                             "merge": Action.UPDATE, "bulk": Action.UPDATE, "duplicates": Action.VIEW}

    service_create = services.lead_create
    service_update = services.lead_update
    service_delete = services.lead_delete

    def get_queryset(self):
        return selectors.leads_qs()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "retrieve":
            ctx["with_duplicates"] = True
        if self.action == "list" and services.crm_settings().duplicates_enabled:
            ctx["dup_keys"] = services.duplicate_keys()
        return ctx

    @action(detail=False, methods=["get"])
    def board(self, request):
        pid = request.query_params.get("pipeline")
        p = Pipeline.objects.filter(pk=pid).first() if pid and pid.isdigit() else None
        p = p or services.default_pipeline()
        leads = selectors.board_leads(p, self.filter_queryset(self.get_queryset()),
                                      closed_all=request.query_params.get("closed") == "all")
        ctx = {"dup_keys": services.duplicate_keys() if services.crm_settings().duplicates_enabled else None}
        by_stage: dict[int, list] = {}
        for card in LeadListSerializer(leads, many=True, context=ctx).data:
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
        return Response(LeadSerializer(self._reload(lead), context={"with_duplicates": True}).data)

    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        _need(request, Pages.PROJECTS, Action.CREATE, "Loyiha ochish uchun ruxsat yo'q")
        s = ConvertSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        lead = services.lead_convert(self.get_object(), actor=request.user, **s.validated_data)
        return Response(LeadSerializer(self._reload(lead)).data)

    @action(detail=True, methods=["post"])
    def merge(self, request, pk=None):
        """This lead folds into `into_id` (the duplicates box on the card: «Shu yerga birlashtirish»)."""
        s = MergeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        into = services.lead_merge(self.get_object(), actor=request.user, **s.validated_data)
        return Response(LeadSerializer(self._reload(into), context={"with_duplicates": True}).data)

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        s = BulkSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if s.validated_data["action"] == "delete":
            _need(request, Pages.CRM, Action.DELETE)
        return Response({"updated": services.leads_bulk(actor=request.user, **s.validated_data)})

    @action(detail=False, methods=["get"])
    def duplicates(self, request):
        return Response(services.duplicates_check(request.query_params.get("phone", ""),
                                                  request.query_params.get("email", "")))


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


# ------------------------------------------------------------------ connections


class ConnectionViewSet(ServiceModelViewSet):
    """Telephony providers and lead sources. Reading needs crm.view; changing a telephony one needs
    telephony.update, a lead source crm.update."""

    page_key = Pages.CRM
    serializer_class = ConnectionSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    permission_action_map = {"create": Action.VIEW, "partial_update": Action.VIEW, "destroy": Action.VIEW,
                             "catalog": Action.VIEW, "check": Action.VIEW, "sync": Action.VIEW, "token": Action.VIEW}

    def get_queryset(self):
        return Connection.objects.all()

    def _can_change(self, kind: str) -> None:
        page = Pages.TELEPHONY if kind in Connection.TELEPHONY else Pages.CRM
        _need(self.request, page, Action.UPDATE)

    def _out(self, conn, code=http.HTTP_200_OK):
        return Response(ConnectionSerializer(Connection.objects.get(pk=conn.pk), context={"request": self.request}).data,
                        status=code)

    def create(self, request, *args, **kwargs):
        s = ConnectionWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if not s.validated_data.get("kind"):
            raise ValidationFailed("Ulanish turini tanlang", field="kind")
        self._can_change(s.validated_data["kind"])
        conn = services.connection_create(actor=request.user, request=request, **s.validated_data)
        return self._out(conn, http.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        conn = self.get_object()
        self._can_change(conn.kind)
        s = ConnectionWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = {k: v for k, v in s.validated_data.items() if k != "kind"}
        return self._out(services.connection_update(conn, actor=request.user, request=request, **data))

    def destroy(self, request, *args, **kwargs):
        conn = self.get_object()
        self._can_change(conn.kind)
        services.connection_delete(conn, actor=request.user)
        return Response(status=http.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def catalog(self, request):
        return Response(catalog.KINDS)

    @action(detail=True, methods=["post"])
    def check(self, request, pk=None):
        conn = self.get_object()
        self._can_change(conn.kind)
        return Response(services.connection_check(conn, actor=request.user, request=request))

    @action(detail=True, methods=["post"])
    def sync(self, request, pk=None):
        conn = self.get_object()
        self._can_change(conn.kind)
        days = int(request.query_params.get("days") or 3)
        return Response(services.connection_sync(conn, days=days, actor=request.user))

    @action(detail=True, methods=["post"])
    def token(self, request, pk=None):
        conn = self.get_object()
        self._can_change(conn.kind)
        return self._out(services.connection_rotate_token(conn, actor=request.user, request=request))


def _payload(request):
    """JSON (object or list) or a form post; for a GET the query string."""
    if request.content_type and "json" in request.content_type or request.body[:1] in (b"{", b"["):
        try:
            return json.loads(request.body or b"{}")
        except ValueError as e:
            raise ValidationFailed("JSON xato") from e
    data = request.POST.dict() if request.method == "POST" else {}
    return data or {k: v for k, v in request.GET.items() if k != "token"}


def _hook_conn(token: str, *, telephony: bool | None = None, kind: str | None = None) -> Connection:
    conn = Connection.objects.filter(token=token, enabled=True).first()
    if conn is None or (telephony is not None and conn.is_telephony != telephony) or (kind and conn.kind != kind):
        raise NotFound("Not found")
    return conn


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def leads_hook(request, token: str):
    """Website forms / Yuboraman. The random token is the access. GET answers a sender's link check
    (echoing hub.challenge for Facebook-style senders)."""
    conn = _hook_conn(token, telephony=False)
    if conn.kind == Connection.Kind.AMOCRM:
        raise NotFound("Not found")
    if request.method == "GET":
        challenge = request.GET.get("hub.challenge") or request.GET.get("challenge")
        if challenge:
            return HttpResponse(challenge[:200], content_type="text/plain")
        return Response({"ok": True, "name": conn.name})
    return Response({"ok": True, "leads": services.intake_many(conn, _payload(request))})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def amocrm_hook(request, token: str):
    conn = _hook_conn(token, kind=Connection.Kind.AMOCRM)
    try:
        return Response({"ok": True, "leads": services.amo_hook(conn, request.POST.dict())})
    except ProviderError as e:
        raise ValidationFailed(str(e)) from e


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def amocrm_redirect(request):
    """The Redirect URI an amoCRM private integration needs. Rombo connects with the code from «Ключи и
    доступы», so this page only shows a code amoCRM sends here, to paste into Rombo."""
    code = request.GET.get("code", "")[:2000]
    body = (f"<p>amoCRM avtorizatsiya kodi:</p><textarea readonly cols=80 rows=4>{code}</textarea>"
            "<p>Uni Rombo → CRM → Sozlamalar → Ulanishlar → amoCRM'dagi «Avtorizatsiya kodi» maydoniga qo'ying.</p>"
            if code else "<p>Rombo amoCRM integratsiyasi uchun Redirect URI.</p>")
    return HttpResponse(f"<!doctype html><meta charset=utf-8><title>Rombo · amoCRM</title>{body}")


# ------------------------------------------------------------------ telephony


class CallFilter(django_filters.FilterSet):
    direction = django_filters.ChoiceFilter(choices=CallDirection.choices)
    status = django_filters.MultipleChoiceFilter(choices=CallStatus.choices)
    user = django_filters.NumberFilter(field_name="user_id")
    lead = django_filters.NumberFilter(field_name="lead_id")
    client = django_filters.NumberFilter(field_name="client_id")
    connection = django_filters.NumberFilter(field_name="connection_id")
    date_from = django_filters.CharFilter(method="filter_from")
    date_to = django_filters.CharFilter(method="filter_to")
    mine = django_filters.BooleanFilter(method="filter_mine")

    class Meta:
        model = Call
        fields = ["direction", "status", "user", "lead", "client", "connection"]

    def filter_from(self, qs, name, value):
        return qs.filter(started_at__gte=_day(value))

    def filter_to(self, qs, name, value):
        return qs.filter(started_at__lt=_day(value, end=True))

    def filter_mine(self, qs, name, value):
        return qs.filter(user=self.request.user) if value else qs


class CallViewSet(TabularMixin, ServiceModelViewSet):
    page_key = Pages.TELEPHONY
    serializer_class = CallSerializer
    filterset_class = CallFilter
    search_fields = ["client_phone", "from_number", "to_number", "client__name", "lead__title", "note"]
    ordering_fields = ["started_at", "duration"]
    ordering = ["-started_at", "-id"]
    http_method_names = ["get", "post", "patch", "head", "options"]  # calls come from the PBX
    permission_action_map = {"live": Action.VIEW, "stats": Action.VIEW, "create_lead": Action.UPDATE,
                             "analytics": Action.VIEW}

    excel_name = "qongiroqlar"
    excel_columns = [
        Col("Vaqt", "started_at", kind="date", width=18), Col("Yo'nalish", lambda c: label_of(CallDirection)(c.direction)),
        Col("Holat", lambda c: label_of(CallStatus)(c.status)), Col("Mijoz raqami", "client_phone", width=16),
        Col("Kimdan", "from_number", width=16), Col("Kimga", "to_number", width=16), Col("Ichki raqam", "extension"),
        Col("Operator", "user.full_name", width=20), Col("Mijoz", "client.name", width=24), Col("Lid", "lead.title", width=24),
        Col("Davomiyligi, s", "duration", width=12),
    ]

    def get_queryset(self):
        return selectors.calls_qs().select_related("connection")

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
        _need(request, Pages.CRM, Action.CREATE, "Lid yaratish uchun ruxsat yo'q")
        call = services.call_create_lead(self.get_object(), actor=request.user)
        return Response(CallSerializer(self._reload(call)).data)

    @action(detail=False, methods=["get"])
    def live(self, request):
        """The operator's calls now and just ended (the popup's fallback when the socket is down)."""
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

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        services.expire_stale()
        since, until = _period(request)
        uid, cid = request.query_params.get("user"), request.query_params.get("connection")
        return Response(analytics.telephony_analytics(since, until, int(uid) if uid and uid.isdigit() else None,
                                                      int(cid) if cid and cid.isdigit() else None))


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
        return Extension.objects.select_related("user", "connection")


class TelephonySettingsView(OneRowView):
    """GET / PATCH the rules: what calls do in the CRM."""

    page_key = Pages.TELEPHONY

    def get(self, request):
        return Response(TelephonySettingsSerializer(services.telephony_settings()).data)

    def patch(self, request):
        s = TelephonySettingsSerializer(services.telephony_settings(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        st = services.telephony_settings_update(actor=request.user, **s.validated_data)
        return Response(TelephonySettingsSerializer(st).data)


class MyPhoneView(OneRowView):
    """The current user's extension and browser-phone settings; the softphone reports its calls here;
    click-to-call through the provider."""

    page_key = Pages.TELEPHONY
    permission_action_map = {"get": Action.VIEW, "post": Action.VIEW}

    def get(self, request):
        st = services.telephony_settings()
        return Response({"enabled": st.enabled, "popup": st.popup,
                         "phone": selectors.softphone_config(request.user, st)})

    def post(self, request):
        if request.path.rstrip("/").endswith("dial"):
            s = DialSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            return Response(services.dial(actor=request.user, number=s.validated_data["number"]))
        s = SoftphoneReportSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        call = services.softphone_report(actor=request.user, data=s.validated_data)
        return Response({"id": call.pk if call else None})


class RecordingsView(OneRowView):
    """Drive recordings: status (GET), connect Google / switch on-off / disconnect (POST ?do=)."""

    page_key = Pages.TELEPHONY

    def get(self, request):
        return Response(services.recordings_status())

    def post(self, request):
        do = request.query_params.get("do", "")
        if do == "connect":
            return Response({"url": services.google_connect_url(actor=request.user, request=request,
                                                                back=str(request.data.get("back") or "/telephony/settings"))})
        if do == "switch":
            services.recordings_switch(actor=request.user, enabled=bool(request.data.get("enabled")))
        elif do == "disconnect":
            services.google_disconnect(actor=request.user)
        else:
            raise ValidationFailed("Noma'lum amal")
        return Response(services.recordings_status())


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def google_callback(request):
    """Google sends the browser back here; the signed `state` names who started it and where to return."""
    if request.GET.get("error") or not request.GET.get("code"):
        return HttpResponseRedirect("/telephony/settings?google=cancelled")
    try:
        back = services.google_callback(code=request.GET["code"], state=request.GET.get("state", ""), request=request)
    except (ValidationFailed, ProviderError):
        return HttpResponseRedirect("/telephony/settings?google=error")
    return HttpResponseRedirect(f"{back}?google=connected")


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def recording_stream(request, token: str):
    """A Drive copy of a call recording through a signed 12-hour link (only handed to signed-in users)."""
    from apps.crm.providers import google

    call = services.recording_call(token)
    if call is None:
        return HttpResponse("Havola eskirgan", status=404)
    try:
        client, upstream = google.open_media(services.google_token(), call.recording_file_id,
                                             request.headers.get("Range", ""))
    except ProviderError:
        return HttpResponse("Yozuv ochilmadi", status=502)
    if upstream.status_code >= 400:
        upstream.close()
        client.close()
        return HttpResponse("Yozuv ochilmadi", status=502)

    def chunks():
        try:
            yield from upstream.iter_bytes(65536)
        finally:
            upstream.close()
            client.close()

    resp = StreamingHttpResponse(chunks(), status=upstream.status_code,
                                 content_type=upstream.headers.get("content-type", "audio/mpeg"))
    for h in ("Content-Length", "Content-Range", "Accept-Ranges"):
        if h in upstream.headers:
            resp[h] = upstream.headers[h]
    resp["Cache-Control"] = "private, no-store"
    resp["Content-Disposition"] = "inline"
    return resp


MAX_EVENTS_PER_REQUEST = 50  # the link is public: one request can't make an unbounded number of calls


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def telephony_hook(request, token: str):
    """PBX events (UTeL, Moi Zvonki, any IP-PBX). The connection's random token is the access."""
    conn = _hook_conn(token, telephony=True)
    body = _payload(request)
    items = [x for x in body if isinstance(x, dict)] if isinstance(body, list) else [body]
    calls = [c for p in items[:MAX_EVENTS_PER_REQUEST] if (c := services.ingest(dict(p), conn=conn))]
    return Response({"ok": True, "calls": [c.pk for c in calls]})
