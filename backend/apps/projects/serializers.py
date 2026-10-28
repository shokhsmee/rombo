from rest_framework import serializers

from apps.clients.models import Client, ClientKind
from apps.core.serializers import RefSerializer
from apps.employees.models import Employee
from apps.projects.models import Project, ProjectFile, ProjectItem, ProjectStatus
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
    total_amount = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_quantity = serializers.IntegerField(read_only=True)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta(ProjectListSerializer.Meta):
        fields = [*ProjectListSerializer.Meta.fields, "client_id", "client_phone", "client_segment", "manager_id",
                  "partner", "partner_id", "sales_channel", "sales_channel_id", "brand", "brand_id", "product_name",
                  "phone", "object_address", "location", "contract_number", "contract_date", "service_amount",
                  "advance_amount", "total_amount", "mosquito_net", "dismantling", "items", "total_quantity",
                  "files", "notes", "allowed_statuses", "updated_at"]


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ProjectStatus.choices)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class StatusSummarySerializer(serializers.Serializer):
    status = serializers.CharField()
    count = serializers.IntegerField()


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
