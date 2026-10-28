from django.contrib import admin

from apps.pricing.models import PriceList, PriceListItem


class ItemInline(admin.TabularInline):
    model = PriceListItem
    extra = 0


@admin.register(PriceList)
class PriceListAdmin(admin.ModelAdmin):
    list_display = ["name", "currency", "bar_length_m", "is_active"]
    inlines = [ItemInline]
