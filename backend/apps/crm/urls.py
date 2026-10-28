from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.crm.views import (
    ConnectionViewSet,
    CrmAnalyticsView,
    CrmSettingsView,
    LeadFieldViewSet,
    LeadViewSet,
    LostReasonViewSet,
    PipelineViewSet,
    StageViewSet,
    TaskViewSet,
    amocrm_hook,
    amocrm_redirect,
    leads_hook,
)

router = SimpleRouter()
router.register("pipelines", PipelineViewSet, basename="crm-pipeline")
router.register("stages", StageViewSet, basename="crm-stage")
router.register("lost-reasons", LostReasonViewSet, basename="crm-lost-reason")
router.register("fields", LeadFieldViewSet, basename="crm-field")
router.register("leads", LeadViewSet, basename="crm-lead")
router.register("tasks", TaskViewSet, basename="crm-task")
router.register("connections", ConnectionViewSet, basename="crm-connection")

urlpatterns = [
    path("settings/", CrmSettingsView.as_view(http_method_names=["get", "patch", "options"])),
    path("analytics/", CrmAnalyticsView.as_view(http_method_names=["get", "options"])),
    path("hooks/leads/<str:token>/", leads_hook),
    path("hooks/amocrm/redirect/", amocrm_redirect),
    path("hooks/amocrm/<str:token>/", amocrm_hook),
    *router.urls,
]
