from django.contrib import admin

from apps.telegram.models import Account, Chat


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "owner", "status", "crm_leads", "active"]
    exclude = ["api_hash", "session", "login_session", "code_hash"]  # secrets never shown


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "account", "client", "lead", "unread", "last_at"]
    exclude = ["photo"]
