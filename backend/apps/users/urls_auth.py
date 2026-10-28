from django.urls import path

from apps.users.views import LoginView, RefreshView, change_password_view, me_view

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("me/", me_view, name="auth-me"),
    path("change-password/", change_password_view, name="auth-change-password"),
]
