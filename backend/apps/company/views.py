from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.company.models import Company


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        exclude = ["id", "created_at"]
        read_only_fields = ["updated_at"]


@api_view(["GET", "PATCH"])
def company_view(request):
    """Every user reads the requisites (they print contracts); only the Kompaniya page changes them."""
    company = Company.get()
    if request.method == "PATCH":
        if not has_permission(request.user, Pages.COMPANY, Action.UPDATE):
            raise PermissionDenied("Bu amal uchun ruxsat yo'q")
        s = CompanySerializer(company, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
    return Response(CompanySerializer(company).data)
