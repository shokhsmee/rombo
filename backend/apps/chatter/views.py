from django.apps import apps
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.chatter.models import Message
from apps.chatter.services import note_create
from apps.core.exceptions import NotFound

# Which records have a history, and which page's `view` permission opens it.
CHATTER_PAGES = {
    "projects.project": Pages.PROJECTS,
    "clients.client": Pages.CLIENTS,
    "crm.lead": Pages.CRM,
    "employees.employee": Pages.EMPLOYEES,
    "users.user": Pages.USERS,
    "access.role": Pages.ROLES,
    "pricing.pricelist": Pages.PRICING,
    "procurement.purchaserequest": Pages.PROCUREMENT,
    "procurement.purchaseorder": Pages.PURCHASE_ORDERS,
    "procurement.goodsreceipt": Pages.GOODS_RECEIPTS,
    "accounting.invoice": Pages.INVOICES,
    "accounting.account": Pages.ACCOUNTS,
}


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "kind", "body", "changes", "author", "created_at"]


class NoteSerializer(serializers.Serializer):
    model = serializers.CharField()
    res_id = serializers.IntegerField()
    body = serializers.CharField(allow_blank=True, max_length=4000)


def _record(request, model: str, res_id: int):
    page = CHATTER_PAGES.get(model)
    if page is None:
        raise NotFound("Yozuv topilmadi")
    if not has_permission(request.user, page, Action.VIEW):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Bu amal uchun ruxsat yo'q")
    obj = apps.get_model(model)._default_manager.filter(pk=res_id).first()
    if obj is None:
        raise NotFound("Yozuv topilmadi")
    return obj


@api_view(["GET", "POST"])
def chatter_view(request):
    if request.method == "POST":
        s = NoteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj = _record(request, s.validated_data["model"], s.validated_data["res_id"])
        note_create(obj, actor=request.user, body=s.validated_data["body"])
        msg = Message.objects.filter(model=s.validated_data["model"], res_id=obj.pk).first()
        return Response(MessageSerializer(msg).data, status=201)

    model = request.query_params.get("model", "")
    try:
        res_id = int(request.query_params.get("res_id", ""))
    except ValueError as e:
        raise NotFound("Yozuv topilmadi") from e
    obj = _record(request, model, res_id)
    qs = Message.objects.filter(model=model, res_id=obj.pk)[:300]
    return Response(MessageSerializer(qs, many=True).data)
