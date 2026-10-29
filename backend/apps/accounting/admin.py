from django.contrib import admin

from apps.accounting.models import Account, AccountRole, ExchangeRate, Invoice, JournalEntry, JournalLine


class LineInline(admin.TabularInline):
    model = JournalLine
    extra = 0
    can_delete = False
    readonly_fields = ["account", "debit", "credit", "partner", "project", "currency", "amount_cur", "rate", "memo"]


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "kind", "parent", "is_active", "allow_posting"]
    list_filter = ["kind", "is_active", "allow_posting"]
    search_fields = ["code", "name"]


@admin.register(AccountRole)
class AccountRoleAdmin(admin.ModelAdmin):
    list_display = ["key", "label", "account"]


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ["code", "date", "memo", "source_kind", "status", "total_debit"]
    list_filter = ["status", "source_kind"]
    search_fields = ["code", "memo"]
    inlines = [LineInline]
    readonly_fields = [f.name for f in JournalEntry._meta.fields]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ["code", "kind", "partner", "date", "status", "gross", "currency"]
    list_filter = ["kind", "status"]
    search_fields = ["code", "external_number", "partner__name"]


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ["date", "currency", "rate", "source"]
    list_filter = ["currency"]
