from decimal import Decimal

from rest_framework import serializers

from apps.references.models import RefItem, Uom


class RefItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefItem
        fields = ["id", "kind", "name", "sort_order", "is_active"]
        validators = []  # (kind, name) uniqueness is answered by the service with a clear message


class RefShortSerializer(serializers.ModelSerializer):
    """How a record shows its reference: {"id": 3, "name": "Instagram"}."""

    class Meta:
        model = RefItem
        fields = ["id", "name"]


class UomSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    ratio = serializers.DecimalField(max_digits=16, decimal_places=6, min_value=Decimal("0.000001"), required=False)

    class Meta:
        model = Uom
        fields = ["id", "name", "category", "category_label", "ratio", "aliases", "sort_order", "is_active"]
        validators = []  # name uniqueness is answered by the service with a clear message
