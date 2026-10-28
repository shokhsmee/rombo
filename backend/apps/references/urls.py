from rest_framework.routers import SimpleRouter

from apps.references.views import RefItemViewSet

router = SimpleRouter()
router.register("", RefItemViewSet, basename="refitem")

urlpatterns = router.urls
