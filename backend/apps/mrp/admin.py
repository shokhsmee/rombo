from django.contrib import admin

from apps.mrp.models import Bom, BomLine, ItemSpec, ProjectMaterial


class BomLineInline(admin.TabularInline):
    model = BomLine
    extra = 0


@admin.register(Bom)
class BomAdmin(admin.ModelAdmin):
    list_display = ["code", "product", "name", "version", "is_active"]
    list_filter = ["is_active"]
    inlines = [BomLineInline]


admin.site.register(ItemSpec)
admin.site.register(ProjectMaterial)
