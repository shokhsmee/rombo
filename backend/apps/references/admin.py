from django.contrib import admin

from apps.references.models import RefItem


@admin.register(RefItem)
class RefItemAdmin(admin.ModelAdmin):
    list_display = ["kind", "name", "sort_order", "is_active"]
    list_filter = ["kind", "is_active"]
    search_fields = ["name"]
