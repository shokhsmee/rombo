from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.access.models import Role
from apps.access.services import effective_permissions
from apps.users.models import User


class RoleRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name"]


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    roles = RoleRefSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "first_name", "last_name", "email", "phone",
                  "is_active", "is_superuser", "last_login", "roles"]


class UserSerializer(UserListSerializer):
    role_ids = serializers.PrimaryKeyRelatedField(
        source="roles", queryset=Role.objects.all(), many=True, write_only=True, required=False
    )
    password = serializers.CharField(write_only=True, required=False, min_length=8,
                                     style={"input_type": "password"})
    permissions = serializers.SerializerMethodField()
    employee = serializers.SerializerMethodField()

    class Meta(UserListSerializer.Meta):
        fields = [*UserListSerializer.Meta.fields, "role_ids", "password", "permissions", "employee",
                  "date_joined"]
        read_only_fields = ["last_login", "date_joined"]
        extra_kwargs = {"first_name": {"required": True, "allow_blank": False}}

    def get_permissions(self, obj) -> dict[str, list[str]]:
        return effective_permissions(obj)

    def get_employee(self, obj) -> dict | None:
        emp = getattr(obj, "employee", None)
        return {"id": emp.id, "code": emp.code, "name": emp.name} if emp else None

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Parol kiritilishi shart"})
        if attrs.get("password"):
            validate_password(attrs["password"])
        return attrs


class MeSerializer(UserListSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta(UserListSerializer.Meta):
        fields = [*UserListSerializer.Meta.fields, "permissions"]

    def get_permissions(self, obj) -> dict[str, list[str]]:
        return effective_permissions(obj)


class PasswordSerializer(serializers.Serializer):
    password = serializers.CharField(min_length=8, write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)
