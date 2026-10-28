from rest_framework import serializers

from apps.pricing.models import PriceList, PriceListItem
from apps.references.models import RefItem, RefKind
from apps.references.serializers import RefShortSerializer


class PriceListItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = PriceListItem
        fields = ["id", "name", "unit", "price", "is_active"]
        extra_kwargs = {"price": {"min_value": 0}}


class PriceListListSerializer(serializers.ModelSerializer):
    product_type = RefShortSerializer(read_only=True)
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PriceList
        fields = ["id", "name", "product_type", "bar_length_m", "currency", "is_active", "items_count"]


class PriceListSerializer(PriceListListSerializer):
    product_type_id = serializers.PrimaryKeyRelatedField(
        source="product_type", queryset=RefItem.objects.filter(kind=RefKind.PRODUCT_TYPE), allow_null=True,
        required=False)
    items = PriceListItemSerializer(many=True, required=False)

    class Meta(PriceListListSerializer.Meta):
        fields = [*PriceListListSerializer.Meta.fields, "product_type_id", "notes", "items", "updated_at"]
