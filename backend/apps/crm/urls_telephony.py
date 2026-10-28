from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.crm.views import (
    CallViewSet,
    ExtensionViewSet,
    MyPhoneView,
    RecordingsView,
    TelephonySettingsView,
    google_callback,
    recording_stream,
    telephony_hook,
)

router = SimpleRouter()
router.register("calls", CallViewSet, basename="telephony-call")
router.register("extensions", ExtensionViewSet, basename="telephony-extension")

urlpatterns = [
    path("settings/", TelephonySettingsView.as_view(http_method_names=["get", "patch", "options"])),
    path("me/", MyPhoneView.as_view(http_method_names=["get", "options"])),
    path("softphone/", MyPhoneView.as_view(http_method_names=["post", "options"])),
    path("dial/", MyPhoneView.as_view(http_method_names=["post", "options"])),
    path("recordings/", RecordingsView.as_view(http_method_names=["get", "post", "options"])),
    path("recordings/google/callback/", google_callback),
    path("recordings/<str:token>/", recording_stream),
    path("hook/<str:token>/", telephony_hook),
    *router.urls,
]
