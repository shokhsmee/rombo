from rest_framework import serializers

from apps.clients.models import Client
from apps.core.serializers import RefSerializer, UserRefSerializer
from apps.employees.models import Employee
from apps.projects.models import Project, ProjectStatus, ProjectStatusLog


class StatusLogSerializer(serializers.ModelSerializer):
    user = UserRefSerializer(read_only=True)

    class Meta:
        model = ProjectStatusLog
        fields = ["id", "from_status", "to_status", "comment", "created_at", "user"]


class ProjectListSerializer(serializers.ModelSerializer):
    client = RefSerializer(read_only=True)
    manager = RefSerializer(read_only=True)

    class Meta:
        model = Project
        fields = ["id", "code", "name", "status", "client", "manager", "region", "deadline", "amount",
                  "currency", "created_at"]
        read_only_fields = ["status"]


class ProjectSerializer(ProjectListSerializer):
    client_id = serializers.PrimaryKeyRelatedField(source="client", queryset=Client.objects.all())
    manager_id = serializers.PrimaryKeyRelatedField(source="manager", queryset=Employee.objects.all(),
                                                    allow_null=True, required=False)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)
    history = StatusLogSerializer(many=True, read_only=True)

    class Meta(ProjectListSerializer.Meta):
        fields = [*ProjectListSerializer.Meta.fields, "client_id", "manager_id", "object_address",
                  "contract_number", "contract_date", "notes", "allowed_statuses", "history",
                  "updated_at"]


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ProjectStatus.choices)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class StatusSummarySerializer(serializers.Serializer):
    status = serializers.CharField()
    count = serializers.IntegerField()
