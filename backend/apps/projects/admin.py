from django.contrib import admin

from apps.projects.models import Project, ProjectStatusLog


class StatusLogInline(admin.TabularInline):
    model = ProjectStatusLog
    extra = 0
    readonly_fields = ["from_status", "to_status", "comment", "user", "created_at"]
    can_delete = False


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "client", "status", "deadline", "amount", "currency"]
    list_filter = ["status", "currency"]
    search_fields = ["code", "name", "client__name"]
    raw_id_fields = ["client", "manager"]
    inlines = [StatusLogInline]
