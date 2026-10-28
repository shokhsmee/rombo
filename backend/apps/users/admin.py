from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.users.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = (*BaseUserAdmin.fieldsets, ("Rombo", {"fields": ("phone", "roles")}))
    filter_horizontal = ("roles", "groups", "user_permissions")
    list_display = ["username", "first_name", "last_name", "is_active", "is_superuser", "last_login"]
