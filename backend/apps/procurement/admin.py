from django.contrib import admin

from apps.procurement.models import GoodsReceipt, PurchaseOrder, PurchaseRequest


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ["code", "project", "status", "needed_by"]
    list_filter = ["status"]
    search_fields = ["code", "project__code", "project__name"]
    raw_id_fields = ["project", "requester", "approved_by"]


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ["code", "supplier", "status", "date", "currency"]
    list_filter = ["status", "currency"]
    search_fields = ["code", "supplier__name"]
    raw_id_fields = ["supplier", "project", "sent_by"]


@admin.register(GoodsReceipt)
class GoodsReceiptAdmin(admin.ModelAdmin):
    list_display = ["code", "order", "supplier", "status", "date"]
    list_filter = ["status"]
    search_fields = ["code", "order__code", "supplier__name"]
    raw_id_fields = ["order", "supplier", "storekeeper", "posted_by"]
