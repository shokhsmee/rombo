from rest_framework import serializers

from apps.mcp.models import McpToken, TokenScope


class McpTokenSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = McpToken
        fields = ["id", "name", "prefix", "scope", "expires_at", "is_expired", "last_used_at", "created_at"]
        read_only_fields = fields


class McpTokenCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    scope = serializers.ChoiceField(choices=TokenScope.choices, default=TokenScope.READ)
    expires_days = serializers.IntegerField(min_value=1, max_value=365, required=False, allow_null=True,
                                            default=None)
