from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from rest_framework import serializers

from apps.clients.models import Client
from apps.core.serializers import RefSerializer
from apps.employees.models import Employee
from apps.references.models import RefItem, RefKind
from apps.references.serializers import RefShortSerializer


class CoordinateField(serializers.DecimalField):
    """Degrees with 6 decimals. Longer input is rounded, not rejected: points pasted from Google have 7+."""

    def __init__(self, limit: int, label: str, **kw):
        msg = f"{label} {-limit}…{limit} oralig'ida bo'lishi kerak"
        super().__init__(max_digits=9, decimal_places=6, min_value=-limit, max_value=limit, allow_null=True,
                         required=False, error_messages={"min_value": msg, "max_value": msg,
                                                         "invalid": f"{label} — son kiriting"}, **kw)

    def to_internal_value(self, data):
        try:
            data = Decimal(str(data).strip()).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        except (InvalidOperation, ValueError):
            pass  # let DecimalField report it
        return super().to_internal_value(data)


class ClientListSerializer(serializers.ModelSerializer):
    manager = RefSerializer(read_only=True)
    segment = RefShortSerializer(read_only=True)

    class Meta:
        model = Client
        fields = ["id", "code", "kind", "name", "tin", "contact_person", "phone", "region", "is_active",
                  "manager", "segment", "latitude", "longitude"]


class ClientSerializer(ClientListSerializer):
    manager_id = serializers.PrimaryKeyRelatedField(source="manager", queryset=Employee.objects.all(),
                                                    allow_null=True, required=False)
    segment_id = serializers.PrimaryKeyRelatedField(source="segment", queryset=RefItem.objects.filter(kind=RefKind.CLIENT_SEGMENT),
                                                    allow_null=True, required=False)
    latitude = CoordinateField(90, "Kenglik")
    longitude = CoordinateField(180, "Uzunlik")
    projects_count = serializers.IntegerField(read_only=True)

    class Meta(ClientListSerializer.Meta):
        fields = [*ClientListSerializer.Meta.fields, "phone_extra", "email", "address", "source", "notes",
                  "manager_id", "segment_id", "passport", "bank_account", "bank_name", "mfo", "price_currency",
                  "prepay_percent", "credit_days", "projects_count", "created_at", "updated_at"]


class ClientMapSerializer(serializers.ModelSerializer):
    """One pin: just what the popup and the list beside the map show."""

    manager = RefSerializer(read_only=True)
    segment = RefShortSerializer(read_only=True)
    lat = serializers.FloatField(source="latitude")
    lng = serializers.FloatField(source="longitude")
    active_projects = serializers.IntegerField()

    class Meta:
        model = Client
        fields = ["id", "code", "name", "kind", "phone", "region", "segment", "manager", "lat", "lng",
                  "active_projects"]
