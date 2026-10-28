from django.contrib import admin

from apps.clients.models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "kind", "phone", "region", "is_active"]
    list_filter = ["kind", "region", "is_active"]
    search_fields = ["code", "name", "tin", "phone"]
