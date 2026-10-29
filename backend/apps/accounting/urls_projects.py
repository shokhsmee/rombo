"""Mounted under /api/v1/projects/ before the projects app's own routes (config/urls.py)."""

from django.urls import path

from apps.accounting.views import project_invoice_view

urlpatterns = [path("<int:pk>/invoice/", project_invoice_view, name="project-invoice")]
