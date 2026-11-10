from rest_framework import serializers

from apps.core.serializers import UserRefSerializer
from apps.specs.models import TRANSITIONS, FixIdea, IdeaStatus, SpecDocument


class SpecDocumentListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecDocument
        fields = ["id", "path", "kind", "ref", "title", "requirements", "synced_at"]


class SpecDocumentSerializer(SpecDocumentListSerializer):
    class Meta(SpecDocumentListSerializer.Meta):
        fields = [*SpecDocumentListSerializer.Meta.fields, "content", "sha256"]


class FixIdeaSerializer(serializers.ModelSerializer):
    created_by = UserRefSerializer(read_only=True)
    allowed_statuses = serializers.SerializerMethodField()

    class Meta:
        model = FixIdea
        fields = ["id", "code", "title", "kind", "capability", "priority", "problem", "proposal", "impact",
                  "status", "source", "change_id", "resolution", "allowed_statuses", "created_by", "created_at",
                  "updated_at"]
        read_only_fields = ["code", "status", "source", "resolution"]

    def get_allowed_statuses(self, obj) -> list[str]:
        return sorted(TRANSITIONS.get(obj.status, set()))


class FixIdeaListSerializer(serializers.ModelSerializer):
    created_by = UserRefSerializer(read_only=True)

    class Meta:
        model = FixIdea
        fields = ["id", "code", "title", "kind", "capability", "priority", "status", "source", "change_id",
                  "created_by", "created_at"]


class IdeaStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=IdeaStatus.choices)
    comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=4000)
