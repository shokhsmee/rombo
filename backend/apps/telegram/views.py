"""Telegram API (uzbridge tgchat/api.py). Page `telegram`: chats are read and written only by the account's
owner; someone with `telegram.update` sees every account and can disconnect or delete it, never read it."""

import base64

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import PagePermission
from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.core.exceptions import NotFound
from apps.telegram import services
from apps.telegram.models import Account, Chat
from apps.telegram.serializers import (
    AccountSerializer,
    AccountWriteSerializer,
    ChatClientSerializer,
    ChatSerializer,
    FileSerializer,
    SignInSerializer,
    TextSerializer,
)


def _manager(user) -> bool:
    return has_permission(user, Pages.TELEGRAM, Action.UPDATE)


class AccountViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, PagePermission]
    page_key = Pages.TELEGRAM
    serializer_class = AccountSerializer
    pagination_class = None
    permission_action_map = {"create": Action.VIEW, "partial_update": Action.VIEW, "destroy": Action.VIEW,
                             "send_code": Action.VIEW, "sign_in": Action.VIEW, "sync": Action.VIEW,
                             "disconnect": Action.VIEW}

    def get_queryset(self):
        qs = Account.objects.select_related("owner")
        return qs if _manager(self.request.user) else qs.filter(owner=self.request.user)

    def _own(self) -> Account:
        acc = self.get_object()
        if acc.owner_id != self.request.user.pk:
            raise PermissionDenied("Bu akkaunt sizniki emas")
        return acc

    def _out(self, acc, code=http.HTTP_200_OK):
        return Response(AccountSerializer(Account.objects.get(pk=acc.pk)).data, status=code)

    def list(self, request):
        accounts = sorted(self.get_queryset(), key=lambda a: (a.owner_id != request.user.pk, a.pk))
        return Response({
            "accounts": [{**AccountSerializer(a).data, "mine": a.owner_id == request.user.pk} for a in accounts],
            "default_api": bool(settings.TELEGRAM_API_ID and settings.TELEGRAM_API_HASH),
            "can_manage": _manager(request.user),
            "crm": has_permission(request.user, Pages.CRM, Action.VIEW),
        })

    def create(self, request):
        s = AccountWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._out(services.account_create(actor=request.user, **s.validated_data), http.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        s = AccountWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = {k: v for k, v in s.validated_data.items() if k != "phone"}
        return self._out(services.account_update(self._own(), actor=request.user, **data))

    def destroy(self, request, pk=None):
        acc = self.get_object()  # the owner, or a manager (get_queryset)
        services.account_delete(acc, actor=request.user)
        return Response(status=http.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="send-code")
    def send_code(self, request, pk=None):
        return self._out(services.account_send_code(self._own(), actor=request.user))

    @action(detail=True, methods=["post"], url_path="sign-in")
    def sign_in(self, request, pk=None):
        s = SignInSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        acc = self._own()
        done = services.account_sign_in(acc, actor=request.user, **s.validated_data)
        return Response({"done": done, "need_password": not done,
                         "account": AccountSerializer(Account.objects.get(pk=acc.pk)).data})

    @action(detail=True, methods=["post"])
    def sync(self, request, pk=None):
        acc = self._own()
        services.sync_dialogs(acc)
        return self._out(acc)

    @action(detail=True, methods=["post"])
    def disconnect(self, request, pk=None):
        return self._out(services.account_disconnect(self.get_object(), actor=request.user))


class ChatViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """The owner's chats. GET /chats/ is the stored list (fast); GET /chats/live/ pulls fresh previews."""

    permission_classes = [IsAuthenticated, PagePermission]
    page_key = Pages.TELEGRAM
    serializer_class = ChatSerializer
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return Chat.objects.filter(account__owner=self.request.user, active=True).select_related("client", "lead")

    def list(self, request, *args, **kwargs):
        return Response(ChatSerializer(self.get_queryset()[:500], many=True).data)

    @action(detail=False, methods=["get"])
    def live(self, request):
        out = []
        for acc in Account.objects.filter(owner=request.user, active=True).exclude(session=""):
            for chat, last in services.sync_dialogs(acc, limit=100, photos=False):
                if chat.active:
                    out.append({**ChatSerializer(chat).data, "last": last})
        return Response(out)

    @action(detail=True, methods=["post"])
    def open(self, request, pk=None):
        chat = self.get_object()
        return Response({"chat": ChatSerializer(chat).data, **services.chat_open(chat)})

    @action(detail=True, methods=["get"])
    def older(self, request, pk=None):
        return Response(services.chat_older(self.get_object(), int(request.query_params.get("before_tg") or 0)))

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        services.chat_read(self.get_object())
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        s = TextSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(services.send_text(self.get_object(), actor=request.user, text=s.validated_data["text"]))

    @action(detail=True, methods=["post"])
    def file(self, request, pk=None):
        s = FileSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(services.send_file(self.get_object(), actor=request.user, upload=s.validated_data["file"],
                                           caption=s.validated_data["caption"]))

    @action(detail=True, methods=["put", "delete"], url_path=r"messages/(?P<tg_id>\d+)")
    def message(self, request, pk=None, tg_id=None):
        chat = self.get_object()
        if request.method == "DELETE":
            services.delete_message(chat, actor=request.user, tg_id=int(tg_id))
            return Response({"ok": True})
        s = TextSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(services.edit_message(chat, actor=request.user, tg_id=int(tg_id), text=s.validated_data["text"]))

    @action(detail=True, methods=["get"], url_path=r"messages/(?P<tg_id>\d+)/file")
    def message_file(self, request, pk=None, tg_id=None):
        data = services.media(self.get_object(), int(tg_id))
        if not data:
            raise NotFound("Fayl topilmadi")
        if data.get("too_big"):
            return HttpResponse("Fayl 50 MB dan katta — Telegramda oching", status=413)
        resp = HttpResponse(base64.b64decode(data["data"]), content_type=data["mime"])
        disp = "attachment" if request.query_params.get("download") == "1" else "inline"
        from urllib.parse import quote

        resp["Content-Disposition"] = f"{disp}; filename*=UTF-8''{quote(data['name'])}"
        resp["Cache-Control"] = "private, no-store"
        return resp

    @action(detail=True, methods=["get"])
    def photo(self, request, pk=None):
        chat = get_object_or_404(self.get_queryset().exclude(photo=None), pk=pk)
        resp = HttpResponse(bytes(chat.photo), content_type="image/jpeg")
        resp["Cache-Control"] = "private, max-age=86400"
        return resp

    @action(detail=True, methods=["post"])
    def client(self, request, pk=None):
        s = ChatClientSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        chat = self.get_object()
        if s.validated_data.get("new"):
            chat = services.new_client(chat, actor=request.user)
        else:
            chat = services.link_client(chat, actor=request.user, client=s.validated_data.get("client"))
        return Response(ChatSerializer(chat).data)

    @action(detail=True, methods=["post"])
    def lead(self, request, pk=None):
        if not has_permission(request.user, Pages.CRM, Action.CREATE):
            raise PermissionDenied("Lid yaratish uchun ruxsat yo'q")
        return Response(ChatSerializer(services.make_lead(self.get_object(), actor=request.user)).data)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        services.archive(self.get_object(), actor=request.user)
        return Response({"ok": True})
