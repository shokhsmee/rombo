from django.contrib import admin

from apps.chatter.models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["created_at", "model", "res_id", "kind", "author", "body"]
    list_filter = ["kind", "model"]
    search_fields = ["body", "author"]
    readonly_fields = [f.name for f in Message._meta.fields]
