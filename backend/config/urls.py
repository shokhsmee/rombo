from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1 = [
    path("auth/", include("apps.users.urls_auth")),
    path("access/", include("apps.access.urls")),
    path("users/", include("apps.users.urls")),
    path("employees/", include("apps.employees.urls")),
    path("clients/", include("apps.clients.urls")),
    # accounting adds /projects/{id}/invoice/ without projects importing it (ADR 0007): first match wins
    path("projects/", include("apps.accounting.urls_projects")),
    path("projects/", include("apps.projects.urls")),
    path("accounting/", include("apps.accounting.urls")),
    path("kassa/", include("apps.kassa.urls")),
    path("crm/", include("apps.crm.urls")),
    path("telephony/", include("apps.crm.urls_telephony")),
    path("telegram/", include("apps.telegram.urls")),
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
