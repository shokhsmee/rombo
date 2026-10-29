from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.accounting.views import (
    AccountViewSet,
    EntryViewSet,
    InvoiceViewSet,
    RateViewSet,
    ReportsViewSet,
    RoleViewSet,
    partner_balance_view,
    project_money_view,
)

router = SimpleRouter()
router.register("accounts", AccountViewSet, basename="account")
router.register("roles", RoleViewSet, basename="account-role")
router.register("rates", RateViewSet, basename="exchange-rate")
router.register("entries", EntryViewSet, basename="journal-entry")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("reports", ReportsViewSet, basename="accounting-report")

urlpatterns = [
    path("balances/partner/<int:pk>/", partner_balance_view, name="partner-balance"),
    path("balances/project/<int:pk>/", project_money_view, name="project-money"),
    *router.urls,
]
