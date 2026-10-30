from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.mrp.views import BomLineViewSet, BomViewSet, ProjectMaterialsViewSet, plan_to_requests_view, plan_view

router = SimpleRouter()
router.register("boms", BomViewSet, basename="bom")
router.register("bom-lines", BomLineViewSet, basename="bom-line")
router.register("projects", ProjectMaterialsViewSet, basename="mrp-project")

urlpatterns = [
    path("plan/", plan_view, name="mrp-plan"),
    path("plan/to-requests/", plan_to_requests_view, name="mrp-plan-to-requests"),
    *router.urls,
]
