from rest_framework.routers import SimpleRouter

from apps.employees.views import EmployeeViewSet

router = SimpleRouter()
router.register("", EmployeeViewSet, basename="employee")

urlpatterns = router.urls
