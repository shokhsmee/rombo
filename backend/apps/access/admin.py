from django.contrib import admin

from apps.access.models import Role, RolePermission


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "is_system", "updated_at"]
    search_fields = ["name"]
    inlines = [RolePermissionInline]
