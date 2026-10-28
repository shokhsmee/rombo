from rest_framework import serializers

from apps.employees.models import Employee
from apps.users.models import User


class LinkedUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]


class EmployeeListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    user = LinkedUserSerializer(read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "code", "name", "last_name", "first_name", "middle_name", "phone", "department",
                  "position", "status", "hire_date", "user"]


class EmployeeSerializer(EmployeeListSerializer):
    user_id = serializers.PrimaryKeyRelatedField(source="user", queryset=User.objects.all(),
                                                 allow_null=True, required=False)

    class Meta(EmployeeListSerializer.Meta):
        fields = [*EmployeeListSerializer.Meta.fields, "email", "birth_date", "address", "notes", "user_id",
                  "created_at", "updated_at"]
