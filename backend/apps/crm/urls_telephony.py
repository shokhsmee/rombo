from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.crm.views import CallViewSet, ExtensionViewSet, MyPhoneView, TelephonySettingsView, telephony_hook

router = SimpleRouter()
router.register("calls", CallViewSet, basename="telephony-call")
router.register("extensions", ExtensionViewSet, basename="telephony-extension")

urlpatterns = [
    path("settings/", TelephonySettingsView.as_view(http_method_names=["get", "patch", "options"])),
    path("settings/rotate-token/", TelephonySettingsView.as_view(http_method_names=["post", "options"])),
    path("me/", MyPhoneView.as_view(http_method_names=["get", "options"])),
    path("softphone/", MyPhoneView.as_view(http_method_names=["post", "options"])),
    path("hook/<str:token>/", telephony_hook),
    *router.urls,
]
