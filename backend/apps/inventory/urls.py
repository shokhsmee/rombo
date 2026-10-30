from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.inventory.views import ProductViewSet, StockMoveViewSet, WarehouseViewSet, stock_view

router = SimpleRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("products", ProductViewSet, basename="product")
router.register("moves", StockMoveViewSet, basename="stock-move")

urlpatterns = [
    path("stock/", stock_view, name="stock"),
    *router.urls,
]
