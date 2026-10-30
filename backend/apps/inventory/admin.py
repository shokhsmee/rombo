from django.contrib import admin

from apps.inventory.models import Product, StockMove, Warehouse


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ["name", "responsible", "is_default", "is_active"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "sku", "unit", "category", "default_cost", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["code", "name", "sku"]


@admin.register(StockMove)
class StockMoveAdmin(admin.ModelAdmin):
    list_display = ["code", "type", "status", "date", "product", "warehouse", "qty", "amount", "project"]
    list_filter = ["type", "status", "warehouse"]
    search_fields = ["code", "product__name", "source_label"]
    readonly_fields = ["code", "entry", "posted_at", "posted_by", "source_model", "source_id", "source_label"]
