from django.contrib import admin

from apps.crm.models import (
    Call,
    Connection,
    CrmSettings,
    Extension,
    Lead,
    LeadField,
    LeadTask,
    Pipeline,
    Stage,
    TelephonySettings,
)


class StageInline(admin.TabularInline):
    model = Stage
    extra = 0


@admin.register(Pipeline)
class PipelineAdmin(admin.ModelAdmin):
    list_display = ["name", "is_default", "is_active", "position"]
    inlines = [StageInline]


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ["code", "title", "stage", "status", "phone", "manager", "created_at"]
    list_filter = ["status", "pipeline", "stage"]
    search_fields = ["code", "title", "contact_name", "phone"]


@admin.register(LeadTask)
class LeadTaskAdmin(admin.ModelAdmin):
    list_display = ["lead", "kind", "text", "due_at", "assignee", "done"]
    list_filter = ["kind", "done"]


@admin.register(Call)
class CallAdmin(admin.ModelAdmin):
    list_display = ["started_at", "direction", "status", "client_phone", "extension", "user", "duration", "lead"]
    list_filter = ["direction", "status", "source"]
    search_fields = ["client_phone", "external_id"]


@admin.register(Extension)
class ExtensionAdmin(admin.ModelAdmin):
    list_display = ["number", "user", "sip_login", "softphone"]
    exclude = ["sip_password"]  # set in the app; never shown back


admin.site.register(TelephonySettings)


@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "enabled", "status", "last_event_at", "events_count"]
    list_filter = ["kind", "enabled", "status"]
    exclude = ["secrets"]  # set in the app; never shown back


admin.site.register(LeadField)
admin.site.register(CrmSettings)
