from django.contrib import admin

from apps.maintenance.models import BotUser, Master, ServiceRequest


@admin.register(Master)
class MasterAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "phone", "region", "is_active"]
    search_fields = ["code", "name", "phone"]


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ["code", "status", "client", "master", "kind", "created_at"]
    list_filter = ["status", "kind"]
    search_fields = ["code", "client__name", "phone"]
    raw_id_fields = ["client", "project", "master"]


@admin.register(BotUser)
class BotUserAdmin(admin.ModelAdmin):
    list_display = ["bot", "tg_id", "username", "first_name", "phone", "client", "master", "blocked"]
    list_filter = ["bot", "blocked"]
    raw_id_fields = ["client", "master"]
