from django.utils import timezone
from rest_framework import serializers

from apps.clients.models import Client
from apps.core.serializers import RefSerializer, UserRefSerializer
from apps.crm.models import (
    Call,
    Extension,
    Lead,
    LeadTask,
    Pipeline,
    Stage,
    TelephonySettings,
)
from apps.employees.models import Employee
from apps.references.models import RefItem, RefKind
from apps.references.serializers import RefShortSerializer
from apps.users.models import User

# ------------------------------------------------------------------ pipelines


class StageSerializer(serializers.ModelSerializer):
    pipeline_id = serializers.PrimaryKeyRelatedField(source="pipeline", queryset=Pipeline.objects.all())

    class Meta:
        model = Stage
        fields = ["id", "pipeline_id", "name", "hint", "position", "tone", "is_won", "is_lost"]
        read_only_fields = ["is_won", "is_lost"]  # a pipeline's won / lost stages come with it


class StageUpdateSerializer(StageSerializer):
    class Meta(StageSerializer.Meta):
        read_only_fields = ["pipeline_id", "is_won", "is_lost"]


class PipelineSerializer(serializers.ModelSerializer):
    stages = StageSerializer(many=True, read_only=True)

    class Meta:
        model = Pipeline
        fields = ["id", "name", "position", "is_default", "is_active", "stages"]
        read_only_fields = ["position"]


# ------------------------------------------------------------------ leads


class StageRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ["id", "name", "tone", "is_won", "is_lost"]


class LeadListSerializer(serializers.ModelSerializer):
    """A board card / list row. Next-task fields and counts come from selectors.leads_qs annotations."""

    stage = StageRefSerializer(read_only=True)
    client = RefSerializer(read_only=True)
    manager = RefSerializer(read_only=True)
    source = RefShortSerializer(read_only=True)
    project = RefSerializer(read_only=True)
    pipeline_id = serializers.IntegerField(read_only=True)
    next_task_kind = serializers.CharField(read_only=True, allow_null=True, default=None)
    next_task_text = serializers.CharField(read_only=True, allow_null=True, default=None)
    next_task_due = serializers.DateTimeField(read_only=True, allow_null=True, default=None)
    open_tasks = serializers.IntegerField(read_only=True, default=0)
    calls_count = serializers.IntegerField(read_only=True, default=0)
    overdue = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = ["id", "code", "title", "pipeline_id", "stage", "status", "contact_name", "phone", "client",
                  "manager", "source", "budget", "region", "project", "lost_reason", "stage_changed_at",
                  "next_task_kind", "next_task_text", "next_task_due", "open_tasks", "calls_count", "overdue",
                  "created_at", "updated_at"]

    def get_overdue(self, obj) -> bool:
        due = getattr(obj, "next_task_due", None)
        return bool(due and due < timezone.now())


class LeadSerializer(LeadListSerializer):
    stage_id = serializers.PrimaryKeyRelatedField(source="stage", queryset=Stage.objects.all(), required=False)
    client_id = serializers.PrimaryKeyRelatedField(source="client", queryset=Client.objects.all(),
                                                   allow_null=True, required=False)
    manager_id = serializers.PrimaryKeyRelatedField(source="manager", queryset=Employee.objects.all(),
                                                    allow_null=True, required=False)
    source_id = serializers.PrimaryKeyRelatedField(
        source="source", queryset=RefItem.objects.filter(kind=RefKind.SALES_CHANNEL), allow_null=True,
        required=False)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)

    class Meta(LeadListSerializer.Meta):
        fields = [*LeadListSerializer.Meta.fields, "stage_id", "client_id", "manager_id", "source_id", "address",
                  "notes"]
        read_only_fields = ["status", "lost_reason"]

    def validate(self, attrs):
        # the stage changes through /move/ (history line, lost reason), never by a plain edit
        if self.instance is not None:
            attrs.pop("stage", None)
        return attrs


class MoveSerializer(serializers.Serializer):
    stage_id = serializers.PrimaryKeyRelatedField(source="stage", queryset=Stage.objects.all())
    lost_reason = serializers.CharField(required=False, allow_blank=True, max_length=200, default="")


class ConvertSerializer(serializers.Serializer):
    client_id = serializers.PrimaryKeyRelatedField(source="client", queryset=Client.objects.all(), allow_null=True,
                                                   required=False, default=None)
    project_name = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")


class TaskSerializer(serializers.ModelSerializer):
    lead_id = serializers.PrimaryKeyRelatedField(source="lead", queryset=Lead.objects.all())
    assignee = UserRefSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(source="assignee", queryset=User.objects.filter(is_active=True),
                                                     allow_null=True, required=False)
    lead = serializers.SerializerMethodField()

    class Meta:
        model = LeadTask
        fields = ["id", "lead_id", "lead", "kind", "text", "due_at", "assignee", "assignee_id", "done", "done_at",
                  "created_at"]
        read_only_fields = ["done_at"]

    def get_lead(self, obj) -> dict:
        return {"id": obj.lead_id, "code": obj.lead.code, "name": obj.lead.title}


class TaskUpdateSerializer(TaskSerializer):
    class Meta(TaskSerializer.Meta):
        read_only_fields = ["lead_id", "done_at"]


# ------------------------------------------------------------------ telephony


class CallSerializer(serializers.ModelSerializer):
    user = UserRefSerializer(read_only=True)
    client = RefSerializer(read_only=True)
    lead = serializers.SerializerMethodField()
    live = serializers.SerializerMethodField()

    class Meta:
        model = Call
        fields = ["id", "source", "direction", "status", "live", "from_number", "to_number", "client_phone",
                  "extension", "user", "client", "lead", "started_at", "answered_at", "ended_at", "duration", "wait",
                  "recording_url", "note", "created_lead"]

    def get_lead(self, obj) -> dict | None:
        ld = obj.lead
        return {"id": ld.pk, "code": ld.code, "name": ld.title, "status": ld.status} if ld else None

    def get_live(self, obj) -> bool:
        return obj.status in ("ringing", "talking")


class CallUpdateSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    lead_id = serializers.PrimaryKeyRelatedField(source="lead", queryset=Lead.objects.all(), required=False)


class SoftphoneReportSerializer(serializers.Serializer):
    call_id = serializers.CharField(max_length=80)
    event = serializers.ChoiceField(choices=["ringing", "answer", "hangup"])
    direction = serializers.ChoiceField(choices=["in", "out"], required=False)
    to = serializers.CharField(max_length=40, required=False, allow_blank=True)
    billsec = serializers.IntegerField(min_value=0, required=False)

    def to_internal_value(self, data):
        out = super().to_internal_value(data)
        if "from" in data:  # a Python keyword: not declarable as a field
            out["from"] = str(data.get("from") or "")[:40]
        return out


class ExtensionSerializer(serializers.ModelSerializer):
    user = UserRefSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(source="user", queryset=User.objects.all())
    sip_password = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=128)
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = Extension
        fields = ["id", "user", "user_id", "number", "sip_login", "sip_password", "has_password", "softphone"]
        validators = []  # uniqueness is answered by the service with a clear message
        extra_kwargs = {"number": {"validators": []}}

    def get_has_password(self, obj) -> bool:
        return bool(obj.sip_password)


class TelephonySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelephonySettings
        fields = ["enabled", "sip_wss", "sip_domain", "company_numbers", "webhook_token", "incoming_creates_lead",
                  "missed_creates_lead", "missed_task", "missed_task_minutes", "last_event_at"]
        read_only_fields = ["webhook_token", "last_event_at"]
        extra_kwargs = {"missed_task_minutes": {"min_value": 1, "max_value": 1440}}
