from rest_framework import serializers


class RefSerializer(serializers.Serializer):
    """Compact reference to another record: {"id": 3, "code": "MJ-00003", "name": "..."}."""

    id = serializers.IntegerField(read_only=True)
    code = serializers.CharField(read_only=True, allow_null=True, default=None)
    name = serializers.CharField(read_only=True)


class UserRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    full_name = serializers.CharField(read_only=True)
