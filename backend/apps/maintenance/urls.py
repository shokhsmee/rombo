from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.maintenance import views

router = SimpleRouter()
router.register("requests", views.ServiceRequestViewSet, basename="service-request")
router.register("masters", views.MasterViewSet, basename="service-master")

urlpatterns = [
    *router.urls,
    path("photos/<int:pk>/", views.photo_file, name="maintenance-photo"),
    path("bot/<str:kind>/webhook/", views.WebhookView.as_view()),
    # Mini Apps (Telegram initData auth)
    path("app/client/me/", views.ClientMeView.as_view()),
    path("app/client/requests/", views.ClientRequestsView.as_view()),
    path("app/client/requests/<int:pk>/", views.ClientRequestDetailView.as_view()),
    path("app/client/requests/<int:pk>/<str:op>/", views.ClientRequestDetailView.as_view()),
    path("app/master/me/", views.MasterMeView.as_view()),
    path("app/master/jobs/", views.MasterJobsView.as_view()),
    path("app/master/jobs/<int:pk>/", views.MasterJobDetailView.as_view()),
    path("app/master/jobs/<int:pk>/<str:op>/", views.MasterJobDetailView.as_view()),
]
