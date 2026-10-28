from rest_framework.routers import SimpleRouter

from apps.projects.views import ProjectViewSet

router = SimpleRouter()
router.register("", ProjectViewSet, basename="project")

urlpatterns = router.urls
