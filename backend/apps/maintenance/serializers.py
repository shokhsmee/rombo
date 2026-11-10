from django.core import signing
from django.urls import reverse
from rest_framework import serializers

from apps.clients.models import Client
from apps.core.serializers import RefSerializer
from apps.employees.models import Employee
from apps.maintenance.models import (
    Master,
    RequestKind,
    RequestStatus,
    ServicePhoto,
    ServiceRequest,
)
from apps.projects.models import Project

PHOTO_SALT = "maintenance.photo"
PHOTO_MAX_AGE = 7 * 24 * 3600


def photo_url(photo: ServicePhoto) -> str:
    """A signed link: <img> tags can't send the Mini App's auth header. Valid for a week."""
    sig = signing.dumps(photo.pk, salt=PHOTO_SALT, compress=True)
    return f"{reverse('maintenance-photo', args=[photo.pk])}?s={sig}"


class PhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ServicePhoto
        fields = ["id", "stage", "url", "created_at"]

    def get_url(self, obj) -> str:
        return photo_url(obj)


# ------------------------------------------------------------------ ERP


class MasterSerializer(serializers.ModelSerializer):
    employee = RefSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(source="employee", queryset=Employee.objects.all(),
                                                     allow_null=True, required=False)
    telegram = serializers.SerializerMethodField()
    active_jobs = serializers.IntegerField(read_only=True, default=0)
    done_jobs = serializers.IntegerField(read_only=True, default=0)
    rating_avg = serializers.FloatField(read_only=True, default=None)

    class Meta:
        model = Master
        fields = ["id", "code", "name", "phone", "region", "skills", "employee", "employee_id", "is_active",
                  "notes", "telegram", "active_jobs", "done_jobs", "rating_avg", "created_at", "updated_at"]
        read_only_fields = ["code"]

    def get_telegram(self, obj) -> dict | None:
        bu = next(iter(obj.bot_users.all()), None)  # prefetched
        return {"username": bu.username, "name": bu.full_name, "blocked": bu.blocked} if bu else None


class RequestListSerializer(serializers.ModelSerializer):
    client = RefSerializer(read_only=True)
    project = serializers.SerializerMethodField()
    master = RefSerializer(read_only=True)

    class Meta:
        model = ServiceRequest
        fields = ["id", "code", "status", "source", "kind", "client", "project", "master", "phone", "address",
                  "preferred_date", "scheduled_at", "is_warranty", "price", "rating", "created_at"]

    def get_project(self, obj) -> dict | None:
        p = obj.project
        return {"id": p.id, "code": p.code, "name": p.name} if p else None


class RequestSerializer(RequestListSerializer):
    client_id = serializers.PrimaryKeyRelatedField(source="client", queryset=Client.objects.all())
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all(),
                                                    allow_null=True, required=False)
    photos = PhotoSerializer(many=True, read_only=True)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)
    client_telegram = serializers.SerializerMethodField()
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, allow_null=True, required=False,
                                        min_value=-90, max_value=90)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, allow_null=True, required=False,
                                         min_value=-180, max_value=180)

    class Meta(RequestListSerializer.Meta):
        fields = [*RequestListSerializer.Meta.fields, "client_id", "project_id", "description", "latitude",
                  "longitude", "report", "cancel_reason", "feedback", "photos", "allowed_statuses",
                  "client_telegram", "assigned_at", "started_at", "done_at", "closed_at", "updated_at"]
        read_only_fields = ["code", "status", "source", "rating", "report", "cancel_reason", "feedback",
                            "assigned_at", "started_at", "done_at", "closed_at", "scheduled_at"]

    def get_client_telegram(self, obj) -> bool:
        return obj.client.bot_users.filter(bot="client", blocked=False).exists()


class AssignSerializer(serializers.Serializer):
    master_id = serializers.PrimaryKeyRelatedField(source="master", queryset=Master.objects.all())
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True, default=None)


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=RequestStatus.choices)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class PhotoUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    stage = serializers.ChoiceField(choices=["before", "after"], default="before")


# ------------------------------------------------------------------ Mini Apps


def _timeline(obj: ServiceRequest) -> list[dict]:
    steps = [("new", obj.created_at), ("assigned", obj.assigned_at), ("in_progress", obj.started_at),
             ("done", obj.done_at)]
    if obj.status in ("closed", "cancelled"):
        steps.append((obj.status, obj.closed_at))
    return [{"status": s, "label": RequestStatus(s).label, "at": at} for s, at in steps if at]


class AppRequestSerializer(serializers.ModelSerializer):
    """What a client sees about their own request."""

    status_label = serializers.CharField(source="get_status_display")
    kind_label = serializers.CharField(source="get_kind_display")
    master = serializers.SerializerMethodField()
    project = serializers.SerializerMethodField()
    photos = PhotoSerializer(many=True, read_only=True)
    timeline = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = ["id", "code", "status", "status_label", "kind", "kind_label", "description", "address",
                  "preferred_date", "scheduled_at", "is_warranty", "master", "project", "report", "rating",
                  "feedback", "photos", "timeline", "created_at"]

    def get_master(self, obj) -> dict | None:
        m = obj.master
        return {"name": m.name, "phone": m.phone} if m else None

    def get_project(self, obj) -> dict | None:
        p = obj.project
        return {"id": p.id, "code": p.code, "name": p.name} if p else None

    def get_timeline(self, obj) -> list[dict]:
        return _timeline(obj)


class AppJobSerializer(AppRequestSerializer):
    """What a master sees about a job given to them."""

    client = serializers.SerializerMethodField()
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)

    class Meta(AppRequestSerializer.Meta):
        fields = [*AppRequestSerializer.Meta.fields, "client", "phone", "latitude", "longitude", "price"]

    def get_client(self, obj) -> dict:
        return {"name": obj.client.name, "phone": obj.client.phone}


class AppNewRequestSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=RequestKind.choices, default=RequestKind.OTHER)
    description = serializers.CharField(max_length=4000)
    address = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True,
                                        min_value=-90, max_value=90, coerce_to_string=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True,
                                         min_value=-180, max_value=180, coerce_to_string=False)
    preferred_date = serializers.DateField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    photos = serializers.ListField(child=serializers.FileField(), required=False, max_length=10, default=list)

    def to_internal_value(self, data):
        # coordinates from the phone have more decimals than we keep
        if hasattr(data, "copy"):
            data = data.copy()
        for f in ("latitude", "longitude"):
            v = data.get(f)
            if v not in (None, ""):
                try:
                    data[f] = f"{float(v):.6f}"
                except ValueError:
                    pass
            elif f in data:
                data[f] = None
        return super().to_internal_value(data)


class AppRateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    feedback = serializers.CharField(required=False, allow_blank=True, default="", max_length=2000)


class AppCommentSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=2000)


class AppFinishSerializer(serializers.Serializer):
    report = serializers.CharField(max_length=4000)
    photos = serializers.ListField(child=serializers.FileField(), required=False, max_length=10, default=list)
