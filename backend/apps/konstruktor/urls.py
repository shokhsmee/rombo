from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.konstruktor.views import ConstructionViewSet, ProfileSystemViewSet, fill_calc_view, project_summary_view

router = SimpleRouter()
router.register("systems", ProfileSystemViewSet, basename="profile-system")
router.register("constructions", ConstructionViewSet, basename="construction")

urlpatterns = [
    path("projects/<int:pk>/summary/", project_summary_view, name="konstruktor-project-summary"),
    path("projects/<int:pk>/fill-calc/", fill_calc_view, name="konstruktor-fill-calc"),
    *router.urls,
]
