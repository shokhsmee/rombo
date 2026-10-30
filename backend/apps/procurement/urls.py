from rest_framework.routers import SimpleRouter

from apps.procurement.views import (
    ApprovalStepViewSet,
    GoodsReceiptViewSet,
    PurchaseOrderViewSet,
    PurchaseRequestViewSet,
    SupplierViewSet,
)

router = SimpleRouter()
router.register("requests", PurchaseRequestViewSet, basename="purchase-request")
router.register("orders", PurchaseOrderViewSet, basename="purchase-order")
router.register("receipts", GoodsReceiptViewSet, basename="goods-receipt")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("approval-steps", ApprovalStepViewSet, basename="approval-step")

urlpatterns = router.urls
