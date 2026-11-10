from rest_framework.routers import SimpleRouter

from apps.specs import views

router = SimpleRouter()
router.register("documents", views.SpecDocumentViewSet, basename="spec-document")
router.register("ideas", views.FixIdeaViewSet, basename="fix-idea")

urlpatterns = router.urls
