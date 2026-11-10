from django.contrib import admin

from apps.specs.models import FixIdea, SpecDocument


@admin.register(SpecDocument)
class SpecDocumentAdmin(admin.ModelAdmin):
    list_display = ["path", "kind", "ref", "requirements", "synced_at"]
    list_filter = ["kind"]
    search_fields = ["path", "title"]


@admin.register(FixIdea)
class FixIdeaAdmin(admin.ModelAdmin):
    list_display = ["code", "title", "kind", "priority", "status", "source", "created_at"]
    list_filter = ["status", "kind", "source"]
    search_fields = ["code", "title", "problem"]
