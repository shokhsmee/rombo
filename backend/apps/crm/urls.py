from rest_framework.routers import SimpleRouter

from apps.crm.views import LeadViewSet, PipelineViewSet, StageViewSet, TaskViewSet

router = SimpleRouter()
router.register("pipelines", PipelineViewSet, basename="crm-pipeline")
router.register("stages", StageViewSet, basename="crm-stage")
router.register("leads", LeadViewSet, basename="crm-lead")
router.register("tasks", TaskViewSet, basename="crm-task")

urlpatterns = router.urls
