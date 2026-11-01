from rest_framework.routers import SimpleRouter

from apps.references.views import RefItemViewSet, UomViewSet

router = SimpleRouter()
router.register("uoms", UomViewSet, basename="uom")  # before "": its pk pattern would match "uoms"
router.register("", RefItemViewSet, basename="refitem")

urlpatterns = router.urls
