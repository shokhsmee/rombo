from rest_framework import serializers

from apps.references.models import RefItem


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
