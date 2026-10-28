from django.urls import path

from apps.chatter.views import chatter_view

urlpatterns = [path("", chatter_view, name="chatter")]
