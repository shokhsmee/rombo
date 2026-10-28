from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.access.views import RoleViewSet, pages_view

router = SimpleRouter()
router.register("roles", RoleViewSet, basename="role")

urlpatterns = [path("pages/", pages_view, name="access-pages"), *router.urls]
