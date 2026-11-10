from django.conf import settings
from django.core import signing
from django.db.models import Avg, Count, Prefetch, Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.registry import Action, Pages
from apps.core.exceptions import NotFound
from apps.core.views import ServiceModelViewSet
from apps.maintenance import bot, services
from apps.maintenance.models import (
    MASTER_ACTIVE_STATUSES,
    OPEN_STATUSES,
    BotKind,
    BotUser,
    Master,
    RequestKind,
    RequestSource,
    RequestStatus,
    ServicePhoto,
    ServiceRequest,
)
from apps.maintenance.serializers import (
    PHOTO_MAX_AGE,
    PHOTO_SALT,
    AppCommentSerializer,
    AppFinishSerializer,
    AppJobSerializer,
    AppNewRequestSerializer,
    AppRateSerializer,
    AppRequestSerializer,
    AssignSerializer,
    MasterSerializer,
    PhotoSerializer,
    PhotoUploadSerializer,
    RequestListSerializer,
    RequestSerializer,
    StatusChangeSerializer,
)
from apps.maintenance.webapp import bot_user_from_request
from apps.projects.models import Project

S = RequestStatus

# ------------------------------------------------------------------ ERP


class MasterViewSet(ServiceModelViewSet):
    page_key = Pages.SERVICE_MASTERS
    serializer_class = MasterSerializer
    filterset_fields = ["is_active", "region"]
    search_fields = ["code", "name", "phone", "region", "skills"]
    ordering_fields = ["code", "name", "region", "created_at"]
    ordering = ["name"]

    service_create = services.master_create
    service_update = services.master_update
    service_delete = services.master_delete

    def get_queryset(self):
        return Master.objects.select_related("employee").prefetch_related(
            Prefetch("bot_users", queryset=BotUser.objects.filter(bot=BotKind.MASTER))
        ).annotate(
            active_jobs=Count("requests", filter=Q(requests__status__in=MASTER_ACTIVE_STATUSES,
                                                   requests__deleted_at__isnull=True)),
            done_jobs=Count("requests", filter=Q(requests__status__in=[S.DONE, S.CLOSED],
                                                 requests__deleted_at__isnull=True)),
            rating_avg=Avg("requests__rating", filter=Q(requests__deleted_at__isnull=True)),
        )


class ServiceRequestViewSet(ServiceModelViewSet):
    page_key = Pages.SERVICE_REQUESTS
    serializer_class = RequestSerializer
    list_serializer_class = RequestListSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["status", "kind", "master", "client", "project", "is_warranty", "source"]
    search_fields = ["code", "client__name", "phone", "address", "description", "master__name"]
    ordering_fields = ["code", "created_at", "scheduled_at", "status"]
    ordering = ["-created_at"]
    permission_action_map = {
        "assign": Action.UPDATE, "change_status": Action.UPDATE, "upload_photo": Action.UPDATE,
        "delete_photo": Action.UPDATE, "summary": Action.VIEW, "bots": Action.VIEW,
    }

    service_update = services.request_update
    service_delete = services.request_delete

    def get_queryset(self):
        qs = ServiceRequest.objects.select_related("client", "project", "master")
        if self.request.query_params.get("open") in ("1", "true"):
            qs = qs.filter(status__in=OPEN_STATUSES)
        if self.action == "retrieve":
            qs = qs.prefetch_related("photos")
        return qs

    def perform_create(self, serializer):
        source = self.request.data.get("source")
        obj = services.request_create(actor=self.request.user,
                                      source=source if source in RequestSource.values else RequestSource.ERP,
                                      **serializer.validated_data)
        serializer.instance = self._reload(obj)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        s = AssignSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        req = services.request_assign(self.get_object(), actor=request.user, **s.validated_data)
        return Response(RequestSerializer(self._reload(req)).data)

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        s = StatusChangeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        req = services.request_change_status(self.get_object(), actor=request.user, **s.validated_data)
        return Response(RequestSerializer(self._reload(req)).data)

    @action(detail=True, methods=["post"], url_path="photos")
    def upload_photo(self, request, pk=None):
        s = PhotoUploadSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        photo = services.photo_add(self.get_object(), upload=s.validated_data["file"],
                                   stage=s.validated_data["stage"])
        return Response(PhotoSerializer(photo).data, status=http.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_id>\d+)")
    def delete_photo(self, request, pk=None, photo_id=None):
        photo = get_object_or_404(ServicePhoto, pk=photo_id, request=self.get_object())
        services.photo_delete(photo, actor=request.user)
        return Response(status=http.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        rows = ServiceRequest.objects.values("status").annotate(count=Count("id")).order_by("status")
        return Response([{"status": r["status"], "count": r["count"]} for r in rows])

    @action(detail=False, methods=["get"])
    def bots(self, request):
        """Are the bots configured and where do the Mini Apps open? For the hint on the list page."""
        return Response({kind: {"enabled": bot.enabled(kind), "webapp": bot.webapp_url(kind),
                                "webapp_https": bot.webapp_ready(),
                                "users": BotUser.objects.filter(bot=kind).count()}
                         for kind in BotKind.values})


def photo_file(request, pk: int):
    """Signed photo link (serializers.photo_url) for both the ERP and the Mini Apps."""
    try:
        if signing.loads(request.GET.get("s", ""), salt=PHOTO_SALT, max_age=PHOTO_MAX_AGE) != pk:
            raise Http404
    except signing.BadSignature as e:
        raise Http404 from e
    photo = get_object_or_404(ServicePhoto, pk=pk)
    resp = FileResponse(photo.file.open("rb"))
    resp["Cache-Control"] = "private, max-age=86400"
    return resp


# ------------------------------------------------------------------ bot webhook


class WebhookView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, kind: str):
        if kind not in BotKind.values or not bot.enabled(kind):
            raise Http404
        secret = settings.SERVICE_WEBHOOK_SECRET
        if not secret or request.headers.get("X-Telegram-Bot-Api-Secret-Token") != secret:
            return Response(status=http.HTTP_403_FORBIDDEN)
        bot.handle_update(kind, request.data)
        return Response({"ok": True})


# ------------------------------------------------------------------ Mini Apps


class MiniAppView(APIView):
    """Telegram initData auth instead of ERP login; `self.bu` is the bot user (client or master)."""

    authentication_classes = []
    permission_classes = []
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    bot_kind: str

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.bu = bot_user_from_request(request, self.bot_kind)


KINDS = [{"value": v, "label": label} for v, label in RequestKind.choices]


# ---- client


class ClientMeView(MiniAppView):
    bot_kind = BotKind.CLIENT

    def get(self, request):
        c = self.bu.client
        projects = Project.objects.filter(client=c).exclude(status="cancelled").order_by("-created_at")[:20]
        return Response({
            "name": c.name, "phone": c.phone, "address": c.address, "kinds": KINDS,
            "projects": [{"id": p.id, "code": p.code, "name": p.name, "address": p.object_address,
                          "status": p.status} for p in projects],
            "open": c.service_requests.filter(status__in=OPEN_STATUSES).count(),
        })


def _client_requests(bu: BotUser):
    return ServiceRequest.objects.filter(client=bu.client).select_related("master", "project", "client") \
        .prefetch_related("photos")


class ClientRequestsView(MiniAppView):
    bot_kind = BotKind.CLIENT

    def get(self, request):
        return Response(AppRequestSerializer(_client_requests(self.bu)[:100], many=True).data)

    def post(self, request):
        s = AppNewRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        project = None
        if d.get("project_id"):
            project = Project.objects.filter(pk=d["project_id"], client=self.bu.client).first()
            if project is None:
                raise NotFound("Loyiha topilmadi")
        req = services.request_create(
            actor=None, source=RequestSource.BOT, client=self.bu.client, project=project, kind=d["kind"],
            description=d["description"], address=d["address"], latitude=d.get("latitude"),
            longitude=d.get("longitude"), preferred_date=d.get("preferred_date"),
            phone=self.bu.phone or self.bu.client.phone, photos=d["photos"])
        return Response(AppRequestSerializer(_client_requests(self.bu).get(pk=req.pk)).data,
                        status=http.HTTP_201_CREATED)


class ClientRequestDetailView(MiniAppView):
    bot_kind = BotKind.CLIENT
    ACTIONS = {"cancel", "rate", "reopen"}

    def _get(self, pk):
        req = _client_requests(self.bu).filter(pk=pk).first()
        if req is None:
            raise NotFound("Ariza topilmadi")
        return req

    def get(self, request, pk: int):
        return Response(AppRequestSerializer(self._get(pk)).data)

    def post(self, request, pk: int, op: str):
        req, client = self._get(pk), self.bu.client
        if op == "rate":
            s = AppRateSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            services.client_rate(req, client=client, **s.validated_data)
        elif op in ("cancel", "reopen"):
            s = AppCommentSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            if op == "cancel":
                services.client_cancel(req, client=client, reason=s.validated_data["comment"])
            else:
                services.client_reopen(req, client=client, comment=s.validated_data["comment"])
        else:
            raise Http404
        return Response(AppRequestSerializer(self._get(pk)).data)


# ---- master


def _master_jobs(bu: BotUser):
    return ServiceRequest.objects.filter(master=bu.master).select_related("client", "project", "master") \
        .prefetch_related("photos")


class MasterMeView(MiniAppView):
    bot_kind = BotKind.MASTER

    def get(self, request):
        m = self.bu.master
        jobs = ServiceRequest.objects.filter(master=m)
        month = timezone.localdate().replace(day=1)
        agg = jobs.filter(rating__isnull=False).aggregate(avg=Avg("rating"), n=Count("id"))
        return Response({
            "name": m.name, "phone": m.phone, "code": m.code, "region": m.region,
            "active": jobs.filter(status__in=MASTER_ACTIVE_STATUSES).count(),
            "new": jobs.filter(status=S.ASSIGNED).count(),
            "done_month": jobs.filter(status__in=[S.DONE, S.CLOSED], done_at__date__gte=month).count(),
            "rating": round(agg["avg"], 2) if agg["avg"] else None, "ratings": agg["n"],
        })


class MasterJobsView(MiniAppView):
    bot_kind = BotKind.MASTER

    def get(self, request):
        qs = _master_jobs(self.bu)
        if request.query_params.get("scope") == "history":
            qs = qs.exclude(status__in=MASTER_ACTIVE_STATUSES).order_by("-done_at", "-updated_at")[:100]
        else:
            qs = qs.filter(status__in=MASTER_ACTIVE_STATUSES).order_by("scheduled_at", "created_at")
        return Response(AppJobSerializer(qs, many=True).data)


class MasterJobDetailView(MiniAppView):
    bot_kind = BotKind.MASTER

    def _get(self, pk):
        req = _master_jobs(self.bu).filter(pk=pk).first()
        if req is None:
            raise NotFound("Ish topilmadi")
        return req

    def get(self, request, pk: int):
        return Response(AppJobSerializer(self._get(pk)).data)

    def post(self, request, pk: int, op: str):
        req, master = self._get(pk), self.bu.master
        if op == "accept":
            services.master_accept(req, master=master)
        elif op == "decline":
            s = AppCommentSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            services.master_decline(req, master=master, reason=s.validated_data["comment"])
            return Response({"declined": True})
        elif op == "start":
            services.master_start(req, master=master)
        elif op == "finish":
            s = AppFinishSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            services.master_finish(req, master=master, **s.validated_data)
        else:
            raise Http404
        return Response(AppJobSerializer(self._get(pk)).data)
