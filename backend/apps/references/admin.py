from django.contrib import admin

from apps.references.models import RefItem, Uom


@admin.register(RefItem)
class RefItemAdmin(admin.ModelAdmin):
    list_display = ["kind", "name", "sort_order", "is_active"]
    list_filter = ["kind", "is_active"]
    search_fields = ["name"]


@admin.register(Uom)
class UomAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "ratio", "aliases", "is_active"]
    list_filter = ["category", "is_active"]
