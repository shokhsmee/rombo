from rest_framework.routers import SimpleRouter

from apps.telegram.views import AccountViewSet, ChatViewSet

router = SimpleRouter()
router.register("accounts", AccountViewSet, basename="tg-account")
router.register("chats", ChatViewSet, basename="tg-chat")

urlpatterns = router.urls
