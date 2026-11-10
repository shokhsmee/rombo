from django.contrib import admin

from apps.mcp.models import McpToken


@admin.register(McpToken)
class McpTokenAdmin(admin.ModelAdmin):
    list_display = ["prefix", "name", "user", "scope", "expires_at", "last_used_at", "revoked_at"]
    list_filter = ["scope"]
    search_fields = ["prefix", "name", "user__username"]
    readonly_fields = ["key_hash", "prefix", "token_version"]
