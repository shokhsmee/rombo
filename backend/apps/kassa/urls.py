from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.kassa.views import (
    CashAccountViewSet,
    CashOrderViewSet,
    PurposeViewSet,
    cash_book_view,
    summary_view,
)

router = SimpleRouter()
router.register("accounts", CashAccountViewSet, basename="cash-account")
router.register("purposes", PurposeViewSet, basename="payment-purpose")
router.register("orders", CashOrderViewSet, basename="cash-order")

urlpatterns = [
    path("book/", cash_book_view, name="cash-book"),
    path("summary/", summary_view, name="kassa-summary"),
    *router.urls,
]
