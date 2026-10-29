from rest_framework import serializers

from apps.clients.models import Client, ClientKind
from apps.core.serializers import RefSerializer
from apps.employees.models import Employee
from apps.pricing.models import PriceList
from apps.projects.extensions import DETAIL_BLOCKS
from apps.projects.models import Project, ProjectCalc, ProjectCalcLine, ProjectFile, ProjectItem, ProjectStatus
from apps.references.models import RefItem, RefKind
from apps.references.serializers import RefShortSerializer


def ref_field(kind: str, source: str, **kw):
    """Writable `<x>_id` limited to one reference list."""
    return serializers.PrimaryKeyRelatedField(source=source, queryset=RefItem.objects.filter(kind=kind),
                                              allow_null=True, required=False, **kw)


class ProjectItemSerializer(serializers.ModelSerializer):
    product_type = RefShortSerializer(read_only=True)
    product_type_id = serializers.PrimaryKeyRelatedField(
        source="product_type", queryset=RefItem.objects.filter(kind=RefKind.PRODUCT_TYPE))

    class Meta:
        model = ProjectItem
        fields = ["id", "product_type", "product_type_id", "area_m2", "quantity"]
        extra_kwargs = {"quantity": {"min_value": 1}}


class ProjectFileSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.CharField(source="uploaded_by.full_name", default="", read_only=True)

    class Meta:
        model = ProjectFile
        fields = ["id", "name", "size", "created_at", "uploaded_by"]


# ------------------------------------------------------------------ hisob-kitob


class CalcLineSerializer(serializers.ModelSerializer):
    line_sum = serializers.DecimalField(max_digits=16, decimal_places=0, read_only=True)
    item_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProjectCalcLine
        fields = ["id", "item_id", "name", "unit", "price", "qty", "line_sum"]


class CalcSummarySerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=16, decimal_places=0, read_only=True)

    class Meta:
        model = ProjectCalc
        fields = ["id", "title", "currency", "calc_date", "total"]


class CalcSerializer(CalcSummarySerializer):
    lines = CalcLineSerializer(many=True, read_only=True)
    price_list_id = serializers.IntegerField(read_only=True)

    class Meta(CalcSummarySerializer.Meta):
        fields = [*CalcSummarySerializer.Meta.fields, "price_list_id", "bar_length_m", "notes", "lines", "updated_at"]


class CalcCreateSerializer(serializers.Serializer):
    price_list_id = serializers.PrimaryKeyRelatedField(source="price_list", queryset=PriceList.objects.filter(is_active=True))
    calc_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CalcLineInputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    qty = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False)
    price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0, required=False)


class CalcUpdateSerializer(serializers.Serializer):
    calc_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    lines = CalcLineInputSerializer(many=True, required=False)


class ProjectListSerializer(serializers.ModelSerializer):
    client = RefSerializer(read_only=True)
    manager = RefSerializer(read_only=True)
    debt_amount = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_area = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Project
        fields = ["id", "code", "name", "status", "client", "manager", "region", "sale_date", "deadline", "amount",
                  "debt_amount", "total_area", "currency", "created_at"]
        read_only_fields = ["status"]


class ProjectSerializer(ProjectListSerializer):
    client_id = serializers.PrimaryKeyRelatedField(source="client", queryset=Client.objects.all())
    manager_id = serializers.PrimaryKeyRelatedField(source="manager", queryset=Employee.objects.all(),
                                                    allow_null=True, required=False)
    partner = RefSerializer(read_only=True)
    partner_id = serializers.PrimaryKeyRelatedField(source="partner", queryset=Client.objects.filter(kind=ClientKind.DEALER),
                                                    allow_null=True, required=False)
    sales_channel = RefShortSerializer(read_only=True)
    sales_channel_id = ref_field(RefKind.SALES_CHANNEL, "sales_channel")
    brand = RefShortSerializer(read_only=True)
    brand_id = ref_field(RefKind.BRAND, "brand")
    client_segment = RefShortSerializer(source="client.segment", read_only=True, allow_null=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)
    items = ProjectItemSerializer(many=True, required=False)
    files = ProjectFileSerializer(many=True, read_only=True)
    calcs = CalcSummarySerializer(many=True, read_only=True)
    client_address = serializers.CharField(source="client.address", read_only=True)
    client_passport = serializers.CharField(source="client.passport", read_only=True)
    total_amount = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_quantity = serializers.IntegerField(read_only=True)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta(ProjectListSerializer.Meta):
        fields = [*ProjectListSerializer.Meta.fields, "client_id", "client_phone", "client_segment", "manager_id",
                  "partner", "partner_id", "sales_channel", "sales_channel_id", "brand", "brand_id", "product_name",
                  "phone", "object_address", "location", "contract_number", "contract_date", "service_amount",
                  "advance_amount", "total_amount", "mosquito_net", "dismantling", "items", "total_quantity",
                  "files", "notes", "allowed_statuses", "updated_at", "calcs", "usd_rate", "advance_date",
                  "profile_color", "door_accessory", "window_accessory", "windowsill", "glass", "shotlandka",
                  "client_address", "client_passport"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for key, fn in DETAIL_BLOCKS.items():  # "procurement": {requests, orders, received_pct}; "money": ledger
            data[key] = fn(instance)
        return data


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ProjectStatus.choices)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class StatusSummarySerializer(serializers.Serializer):
    status = serializers.CharField()
    count = serializers.IntegerField()


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
