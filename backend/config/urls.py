from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1 = [
    path("auth/", include("apps.users.urls_auth")),
    path("access/", include("apps.access.urls")),
    path("users/", include("apps.users.urls")),
    path("employees/", include("apps.employees.urls")),
    path("clients/", include("apps.clients.urls")),
    path("projects/", include("apps.projects.urls")),
    path("chatter/", include("apps.chatter.urls")),
    path("references/", include("apps.references.urls")),
    path("pricing/", include("apps.pricing.urls")),
    path("company/", include("apps.company.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
]
