from rest_framework.routers import SimpleRouter

from apps.projects.views import ProjectCalcViewSet, ProjectViewSet

calcs = SimpleRouter()
calcs.register(r"(?P<project_pk>\d+)/calcs", ProjectCalcViewSet, basename="project-calc")

router = SimpleRouter()
router.register("", ProjectViewSet, basename="project")

urlpatterns = calcs.urls + router.urls
