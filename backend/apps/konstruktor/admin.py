from django.contrib import admin

from apps.konstruktor.models import Construction, ProfileSystem, ProfileSystemItem


class ItemInline(admin.TabularInline):
    model = ProfileSystemItem
    extra = 0


@admin.register(ProfileSystem)
class ProfileSystemAdmin(admin.ModelAdmin):
    list_display = ["name", "price_list", "bar_length_mm", "is_active", "needs_check"]
    inlines = [ItemInline]


@admin.register(Construction)
class ConstructionAdmin(admin.ModelAdmin):
    list_display = ["code", "project", "name", "size_label", "count"]
    readonly_fields = ["result"]
