from django.contrib import admin

from apps.kassa.models import CashAccount, CashOrder, CodeSequence, PaymentPurpose


@admin.register(CashAccount)
class CashAccountAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "currency", "account", "responsible", "is_active"]
    list_filter = ["kind", "currency", "is_active"]


@admin.register(PaymentPurpose)
class PaymentPurposeAdmin(admin.ModelAdmin):
    list_display = ["name", "direction", "posting", "account_role", "requires_partner", "requires_employee", "is_active"]
    list_filter = ["direction", "posting", "is_active"]


@admin.register(CashOrder)
class CashOrderAdmin(admin.ModelAdmin):
    list_display = ["code", "kind", "status", "date", "account", "amount", "currency", "purpose", "partner"]
    list_filter = ["kind", "status", "account"]
    search_fields = ["code", "basis", "partner__name"]
    readonly_fields = ["code", "entry", "posted_at", "posted_by"]


@admin.register(CodeSequence)
class CodeSequenceAdmin(admin.ModelAdmin):
    list_display = ["prefix", "last"]
