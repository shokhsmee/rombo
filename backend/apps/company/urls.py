from django.urls import path

from apps.company.views import company_view

urlpatterns = [path("", company_view, name="company")]
