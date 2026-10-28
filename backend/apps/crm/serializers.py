from django.utils import timezone
from rest_framework import serializers

from apps.clients.models import Client
from apps.core.crypto import mask
from apps.core.serializers import RefSerializer, UserRefSerializer
from apps.crm import catalog
from apps.crm.models import (
    Call,
    Connection,
    CrmSettings,
    Extension,
    Lead,
    LeadField,
    LeadTask,
    LostReason,
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


class LostReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = LostReason
        fields = ["id", "text", "position"]


class PipelineSerializer(serializers.ModelSerializer):
    stages = StageSerializer(many=True, read_only=True)
    lost_reasons = LostReasonSerializer(many=True, read_only=True)

    class Meta:
        model = Pipeline
        fields = ["id", "name", "position", "is_default", "is_active", "stages", "lost_reasons"]
        read_only_fields = ["position"]


class OrderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), max_length=100)


class TextSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=120)


# ------------------------------------------------------------------ lead fields and settings


class LeadFieldSerializer(serializers.ModelSerializer):
    options = serializers.ListField(child=serializers.CharField(max_length=60, allow_blank=True), required=False,
                                    max_length=50)

    class Meta:
        model = LeadField
        fields = ["id", "key", "label", "type", "section", "options", "position", "active"]
        read_only_fields = ["key"]


class LeadFieldUpdateSerializer(LeadFieldSerializer):
    class Meta(LeadFieldSerializer.Meta):
        read_only_fields = ["key", "type", "section"]


class CrmSettingsSerializer(serializers.ModelSerializer):
    task_types = serializers.ListField(child=serializers.CharField(max_length=40, allow_blank=True), max_length=30,
                                       required=False)  # the service trims, dedupes and caps at 20
    card_fields = serializers.ListField(child=serializers.CharField(max_length=50), max_length=16, required=False)
    distribution_managers = serializers.ListField(child=serializers.IntegerField(), required=False)

    class Meta:
        model = CrmSettings
        fields = ["task_types", "card_fields", "duplicates_enabled", "distribution_enabled", "distribution_mode",
                  "distribution_managers"]


# ------------------------------------------------------------------ leads


class StageRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ["id", "name", "tone", "is_won", "is_lost"]


class LeadListSerializer(serializers.ModelSerializer):
    """A board card / list row. Next-task fields, counts and the last activity come from selectors.leads_qs."""

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
    missed_calls = serializers.IntegerField(read_only=True, default=0)
    last_activity = serializers.SerializerMethodField()
    last_activity_at = serializers.DateTimeField(read_only=True, allow_null=True, default=None)
    overdue = serializers.SerializerMethodField()
    days_in_stage = serializers.SerializerMethodField()
    values = serializers.SerializerMethodField()
    dup = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = ["id", "code", "title", "pipeline_id", "stage", "status", "contact_name", "phone", "client",
                  "manager", "source", "budget", "region", "project", "lost_reason", "stage_changed_at", "tags",
                  "values", "next_task_kind", "next_task_text", "next_task_due", "open_tasks", "calls_count",
                  "missed_calls", "last_activity", "last_activity_at", "overdue", "days_in_stage", "dup",
                  "created_at", "updated_at"]

    def get_overdue(self, obj) -> bool:
        due = getattr(obj, "next_task_due", None)
        return bool(due and due < timezone.now())

    def get_days_in_stage(self, obj) -> int:
        return max(0, (timezone.now() - obj.stage_changed_at).days)

    def get_last_activity(self, obj) -> str | None:
        text = getattr(obj, "last_activity", None)
        return text[:80] if text else None

    def get_values(self, obj) -> dict:
        """Custom field values: the lead's own (deal, extra) and its client's (contact section)."""
        data = getattr(obj.client, "crm_data", None) if obj.client_id else None
        return {**(obj.custom or {}), **((data.custom or {}) if data else {})}

    def get_dup(self, obj) -> bool:
        keys = self.context.get("dup_keys")
        if keys is None:
            return False
        from apps.crm.services.extras import is_duplicate

        return is_duplicate(obj, keys)


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
    tags = serializers.ListField(child=serializers.CharField(max_length=40, allow_blank=True), required=False,
                                 max_length=30)
    custom = serializers.DictField(required=False, write_only=True)
    auto_manager = serializers.BooleanField(required=False, write_only=True)
    duplicates = serializers.SerializerMethodField()

    class Meta(LeadListSerializer.Meta):
        fields = [*LeadListSerializer.Meta.fields, "stage_id", "client_id", "manager_id", "source_id", "address",
                  "notes", "custom", "auto_manager", "duplicates"]
        read_only_fields = ["status", "lost_reason"]

    def validate(self, attrs):
        # the stage changes through /move/ (history line, lost reason), never by a plain edit
        if self.instance is not None:
            attrs.pop("stage", None)
            attrs.pop("auto_manager", None)
        return attrs

    def get_duplicates(self, obj) -> list:
        from apps.crm.services.extras import duplicates_of

        return duplicates_of(obj) if self.context.get("with_duplicates") else []


class MoveSerializer(serializers.Serializer):
    stage_id = serializers.PrimaryKeyRelatedField(source="stage", queryset=Stage.objects.all())
    lost_reason = serializers.CharField(required=False, allow_blank=True, max_length=200, default="")


class ConvertSerializer(serializers.Serializer):
    client_id = serializers.PrimaryKeyRelatedField(source="client", queryset=Client.objects.all(), allow_null=True,
                                                   required=False, default=None)
    project_name = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")


class MergeSerializer(serializers.Serializer):
    into_id = serializers.PrimaryKeyRelatedField(source="into", queryset=Lead.objects.all())


class BulkSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, max_length=500)
    action = serializers.ChoiceField(choices=["move", "assign", "tag", "untag", "lost", "delete"])
    stage_id = serializers.PrimaryKeyRelatedField(source="stage", queryset=Stage.objects.all(), required=False,
                                                  allow_null=True, default=None)
    manager_id = serializers.PrimaryKeyRelatedField(source="manager", queryset=Employee.objects.all(),
                                                    required=False, allow_null=True, default=None)
    tag = serializers.CharField(required=False, allow_blank=True, max_length=40, default="")
    reason = serializers.CharField(required=False, allow_blank=True, max_length=200, default="")


class TaskSerializer(serializers.ModelSerializer):
    lead_id = serializers.PrimaryKeyRelatedField(source="lead", queryset=Lead.objects.all())
    assignee = UserRefSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(source="assignee", queryset=User.objects.filter(is_active=True),
                                                     allow_null=True, required=False)
    lead = serializers.SerializerMethodField()
    kind = serializers.CharField(max_length=40, required=False)

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


# ------------------------------------------------------------------ connections


class ConnectionSerializer(serializers.ModelSerializer):
    kind = serializers.ChoiceField(choices=Connection.Kind.choices)
    config = serializers.DictField(required=False)
    secrets = serializers.SerializerMethodField()
    kind_name = serializers.CharField(source="get_kind_display", read_only=True)
    group = serializers.SerializerMethodField()
    webhook_url = serializers.SerializerMethodField()

    class Meta:
        model = Connection
        fields = ["id", "kind", "kind_name", "group", "name", "enabled", "config", "secrets", "webhook_url", "status",
                  "last_error", "last_sync_at", "last_event_at", "events_count", "created_at"]
        read_only_fields = ["status", "last_error", "last_sync_at", "last_event_at", "events_count"]

    def get_secrets(self, obj) -> dict:
        """Masked, only the keys that are set (never the values)."""
        shown = catalog.secret_keys(obj.kind)
        return {k: mask(str(v)) for k, v in obj.get_secrets().items() if k in shown}

    def get_group(self, obj) -> str:
        return catalog.KIND_BY_KEY[obj.kind]["group"]

    def get_webhook_url(self, obj) -> str:
        from apps.crm.services.connections import amocrm_redirect_uri, webhook_url

        request = self.context.get("request")
        if obj.kind == Connection.Kind.AMOCRM:
            return amocrm_redirect_uri(request)
        return webhook_url(obj, request)


class ConnectionWriteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Connection.Kind.choices, required=False)
    name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    enabled = serializers.BooleanField(required=False)
    config = serializers.DictField(required=False)
    secrets = serializers.DictField(required=False)
    clear_secrets = serializers.ListField(child=serializers.CharField(), required=False)


# ------------------------------------------------------------------ telephony


class CallSerializer(serializers.ModelSerializer):
    user = UserRefSerializer(read_only=True)
    client = RefSerializer(read_only=True)
    lead = serializers.SerializerMethodField()
    live = serializers.SerializerMethodField()
    recording_url = serializers.SerializerMethodField()
    recording_saved = serializers.SerializerMethodField()
    connection = serializers.SerializerMethodField()

    class Meta:
        model = Call
        fields = ["id", "source", "connection", "direction", "status", "live", "from_number", "to_number",
                  "client_phone", "extension", "user", "client", "lead", "started_at", "answered_at", "ended_at",
                  "duration", "wait", "recording_url", "recording_saved", "recording_error", "note", "created_lead"]

    def get_lead(self, obj) -> dict | None:
        ld = obj.lead
        return {"id": ld.pk, "code": ld.code, "name": ld.title, "status": ld.status} if ld else None

    def get_live(self, obj) -> bool:
        return obj.status in ("ringing", "talking")

    def get_recording_url(self, obj) -> str:
        from apps.crm.services.recordings import recording_link

        return recording_link(obj)

    def get_recording_saved(self, obj) -> bool:
        return bool(obj.recording_file_id)

    def get_connection(self, obj) -> dict | None:
        c = obj.connection
        return {"id": c.pk, "name": c.name, "kind": c.kind} if c else None


class CallUpdateSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    lead_id = serializers.PrimaryKeyRelatedField(source="lead", queryset=Lead.objects.all(), required=False)


class DialSerializer(serializers.Serializer):
    number = serializers.CharField(max_length=40)


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
    connection_id = serializers.PrimaryKeyRelatedField(
        source="connection", queryset=Connection.objects.filter(kind__in=Connection.TELEPHONY), allow_null=True,
        required=False)
    sip_password = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=256)
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = Extension
        fields = ["id", "user", "user_id", "number", "connection_id", "sip_login", "sip_password", "has_password",
                  "softphone"]
        validators = []  # uniqueness is answered by the service with a clear message
        extra_kwargs = {"number": {"validators": []}}

    def get_has_password(self, obj) -> bool:
        return bool(obj.sip_password)


class TelephonySettingsSerializer(serializers.ModelSerializer):
    pipeline_id = serializers.PrimaryKeyRelatedField(source="pipeline", queryset=Pipeline.objects.all(),
                                                     allow_null=True, required=False)
    stage_id = serializers.PrimaryKeyRelatedField(
        source="stage", queryset=Stage.objects.filter(is_won=False, is_lost=False), allow_null=True, required=False)
    fixed_manager_id = serializers.PrimaryKeyRelatedField(source="fixed_manager", queryset=Employee.objects.all(),
                                                          allow_null=True, required=False)
    source_id = serializers.PrimaryKeyRelatedField(
        source="source", queryset=RefItem.objects.filter(kind=RefKind.SALES_CHANNEL), allow_null=True, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=40), max_length=10, required=False)

    class Meta:
        model = TelephonySettings
        fields = ["enabled", "incoming_unknown", "missed_unknown", "outgoing_unknown", "duplicate", "pipeline_id",
                  "stage_id", "responsible", "fixed_manager_id", "lead_title", "source_id", "tags", "missed_task",
                  "missed_task_minutes", "popup", "min_duration"]
        extra_kwargs = {"missed_task_minutes": {"min_value": 1, "max_value": 1440},
                        "min_duration": {"max_value": 3600}}
