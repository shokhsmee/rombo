from rest_framework import serializers

from apps.clients.models import Client
from apps.core.serializers import RefSerializer
from apps.employees.models import Employee


class ClientListSerializer(serializers.ModelSerializer):
    manager = RefSerializer(read_only=True)

    class Meta:
        model = Client
        fields = ["id", "code", "kind", "name", "tin", "contact_person", "phone", "region", "is_active",
                  "manager"]


class ClientSerializer(ClientListSerializer):
    manager_id = serializers.PrimaryKeyRelatedField(source="manager", queryset=Employee.objects.all(),
                                                    allow_null=True, required=False)
    projects_count = serializers.IntegerField(read_only=True)

    class Meta(ClientListSerializer.Meta):
        fields = [*ClientListSerializer.Meta.fields, "phone_extra", "email", "address", "source", "notes",
                  "manager_id", "projects_count", "created_at", "updated_at"]
