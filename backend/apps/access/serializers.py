from rest_framework import serializers

from apps.access.models import Role, RolePermission
from apps.access.registry import PAGE_BY_KEY


class PageSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    group = serializers.CharField()
    actions = serializers.ListField(child=serializers.CharField())
    planned = serializers.BooleanField()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = ["page_key", "can_view", "can_create", "can_update", "can_delete"]

    def validate_page_key(self, value):
        if value not in PAGE_BY_KEY:
            raise serializers.ValidationError("Noma'lum sahifa")
        return value


class RoleListSerializer(serializers.ModelSerializer):
    users_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "description", "is_system", "users_count"]


class RoleSerializer(RoleListSerializer):
    permissions = PermissionSerializer(many=True, required=False)

    class Meta(RoleListSerializer.Meta):
        fields = [*RoleListSerializer.Meta.fields, "permissions", "created_at", "updated_at"]
        read_only_fields = ["is_system"]

    def validate_permissions(self, value):
        keys = [p["page_key"] for p in value]
        if len(keys) != len(set(keys)):
            raise serializers.ValidationError("Sahifa takrorlangan")
        return value
