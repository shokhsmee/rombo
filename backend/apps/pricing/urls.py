from rest_framework.routers import SimpleRouter

from apps.pricing.views import PriceListViewSet

router = SimpleRouter()
router.register("", PriceListViewSet, basename="pricelist")

urlpatterns = router.urls
