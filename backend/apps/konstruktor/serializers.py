from rest_framework import serializers

from apps.konstruktor.models import Construction, ProfileSystem, ProfileSystemItem, Role, role_unit
from apps.pricing.models import PriceList, PriceListItem
from apps.projects.models import Project
from apps.references.models import RefItem, RefKind
from apps.references.serializers import RefShortSerializer

MM = dict(max_digits=7, decimal_places=1, min_value=0)


class SystemItemSerializer(serializers.ModelSerializer):
    price_list_item = serializers.PrimaryKeyRelatedField(queryset=PriceListItem.objects.all())
    name = serializers.CharField(source="price_list_item.name", read_only=True)
    unit = serializers.CharField(source="price_list_item.unit", read_only=True)
    price = serializers.DecimalField(source="price_list_item.price", max_digits=14, decimal_places=2, read_only=True)
    role_unit = serializers.SerializerMethodField()

    class Meta:
        model = ProfileSystemItem
        fields = ["id", "role", "price_list_item", "factor", "round_up", "name", "unit", "price", "role_unit"]
        extra_kwargs = {"factor": {"min_value": 0}}

    def get_role_unit(self, obj) -> str:
        return role_unit(obj.role)


class SystemListSerializer(serializers.ModelSerializer):
    price_list = serializers.SerializerMethodField()
    product_type = RefShortSerializer(read_only=True)
    constructions_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ProfileSystem
        fields = ["id", "name", "price_list", "product_type", "bar_length_mm", "is_active", "needs_check",
                  "constructions_count"]

    def get_price_list(self, obj) -> dict:
        return {"id": obj.price_list_id, "name": obj.price_list.name, "currency": obj.price_list.currency}


class SystemSerializer(SystemListSerializer):
    price_list_id = serializers.PrimaryKeyRelatedField(source="price_list", queryset=PriceList.objects.all())
    product_type_id = serializers.PrimaryKeyRelatedField(
        source="product_type", queryset=RefItem.objects.filter(kind=RefKind.PRODUCT_TYPE), allow_null=True,
        required=False)
    default_glass_id = serializers.PrimaryKeyRelatedField(source="default_glass", queryset=PriceListItem.objects.all(),
                                                          allow_null=True, required=False)
    items = SystemItemSerializer(many=True, required=False)

    class Meta(SystemListSerializer.Meta):
        fields = [*SystemListSerializer.Meta.fields, "price_list_id", "product_type_id", "kerf_mm", "trim_mm",
                  "frame_width", "mullion_width", "sash_width", "weld_allowance", "mullion_allowance", "sash_overlap",
                  "glass_deduction_fixed", "glass_deduction_sash", "bead_allowance", "junk_pct", "default_glass_id",
                  "notes", "items", "updated_at"]
        extra_kwargs = {f: {"min_value": 0} for f in (
            "kerf_mm", "trim_mm", "frame_width", "mullion_width", "sash_width", "weld_allowance", "mullion_allowance",
            "sash_overlap", "glass_deduction_fixed", "glass_deduction_sash", "bead_allowance", "junk_pct")}


class ConstructionSerializer(serializers.ModelSerializer):
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all())
    system_id = serializers.PrimaryKeyRelatedField(source="system", queryset=ProfileSystem.objects.all())
    product_type_id = serializers.PrimaryKeyRelatedField(
        source="product_type", queryset=RefItem.objects.filter(kind=RefKind.PRODUCT_TYPE), allow_null=True,
        required=False)
    system = serializers.SerializerMethodField()
    product_type = RefShortSerializer(read_only=True)
    count = serializers.IntegerField(min_value=1, max_value=999, required=False)
    design = serializers.JSONField()

    class Meta:
        model = Construction
        fields = ["id", "code", "project_id", "system_id", "system", "product_type_id", "product_type", "name",
                  "sort_order", "count", "design", "result", "area_m2", "size_label", "notes", "updated_at"]
        read_only_fields = ["code", "result", "area_m2", "size_label"]

    def get_system(self, obj) -> dict:
        return {"id": obj.system_id, "name": obj.system.name, "price_list_id": obj.system.price_list_id}


class PreviewSerializer(serializers.Serializer):
    system_id = serializers.PrimaryKeyRelatedField(source="system", queryset=ProfileSystem.objects.all())
    design = serializers.JSONField()
    count = serializers.IntegerField(min_value=1, max_value=999, default=1)


def role_choices() -> list[dict]:
    return [{"value": r.value, "label": r.label, "unit": role_unit(r.value)} for r in Role]
