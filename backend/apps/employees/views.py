from rest_framework.decorators import action
from rest_framework.response import Response

from apps.access.registry import Pages
from apps.core.views import ServiceModelViewSet
from apps.employees import services
from apps.employees.models import Employee
from apps.employees.serializers import EmployeeListSerializer, EmployeeSerializer


class EmployeeViewSet(ServiceModelViewSet):
    page_key = Pages.EMPLOYEES
    serializer_class = EmployeeSerializer
    list_serializer_class = EmployeeListSerializer
    filterset_fields = ["status", "department"]
    search_fields = ["code", "last_name", "first_name", "middle_name", "phone", "position", "department"]
    ordering_fields = ["code", "last_name", "department", "position", "hire_date", "created_at"]
    ordering = ["last_name", "first_name"]

    service_create = services.employee_create
    service_update = services.employee_update
    service_delete = services.employee_delete

    def get_queryset(self):
        return Employee.objects.select_related("user")

    @action(detail=False, methods=["get"])
    def departments(self, request):
        values = (Employee.objects.exclude(department="").order_by("department")
                  .values_list("department", flat=True).distinct())
        return Response(list(values))
