from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.access.permissions import PagePermission


class ServiceModelViewSet(viewsets.ModelViewSet):
    """ModelViewSet whose writes go through the module's service functions.

    Subclasses set:
      page_key               — registry key checked by PagePermission
      list_serializer_class  — lighter serializer for list (optional)
      service_create/update/delete — plain functions taking keyword-only `actor`

    Views stay thin: validate input (serializer) -> call one service -> render output.
    """

    permission_classes = [IsAuthenticated, PagePermission]
    page_key: str
    list_serializer_class = None

    service_create = None
    service_update = None
    service_delete = None

    def get_serializer_class(self):
        if self.action == "list" and self.list_serializer_class is not None:
            return self.list_serializer_class
        return super().get_serializer_class()

    def _reload(self, obj):
        # Re-read through get_queryset() so the response has the same joins/annotations as GET.
        return self.get_queryset().get(pk=obj.pk)

    def perform_create(self, serializer):
        obj = type(self).service_create(actor=self.request.user, **serializer.validated_data)
        serializer.instance = self._reload(obj)

    def perform_update(self, serializer):
        obj = type(self).service_update(serializer.instance, actor=self.request.user,
                                        **serializer.validated_data)
        serializer.instance = self._reload(obj)

    def perform_destroy(self, instance):
        type(self).service_delete(instance, actor=self.request.user)
