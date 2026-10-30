from rest_framework.decorators import action
from rest_framework.response import Response

from apps.access.registry import Action, Pages
from apps.core.tabular import Bulk, Col, Field, TabularMixin, as_date, label_of, opts
from apps.core.views import ServiceModelViewSet
from apps.employees import services
from apps.employees.models import Employee, EmployeeStatus
from apps.employees.serializers import EmployeeListSerializer, EmployeeSerializer


class EmployeeViewSet(TabularMixin, ServiceModelViewSet):
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

    excel_name = "xodimlar"
    excel_columns = [
        Col("Kod", "code", width=12), Col("Familiya", "last_name"), Col("Ism", "first_name"),
        Col("Otasining ismi", "middle_name"), Col("Telefon", "phone", width=16), Col("Email", "email", width=22),
        Col("Bo'lim", "department"), Col("Lavozim", "position", width=22),
        Col("Ishga kirgan", "hire_date", kind="date", width=12), Col("Tug'ilgan sana", "birth_date", kind="date", width=12),
        Col("Holat", lambda e: label_of(EmployeeStatus)(e.status), width=12), Col("Manzil", "address", width=30),
        Col("Foydalanuvchi", "user.username", width=14),
    ]
    excel_import = [
        Field("Familiya", "last_name", required=True), Field("Ism", "first_name", required=True),
        Field("Otasining ismi", "middle_name"), Field("Telefon", "phone"), Field("Email", "email"),
        Field("Bo'lim", "department"), Field("Lavozim", "position"),
        Field("Ishga kirgan", "hire_date", resolve=as_date, hint="31.10.2026"),
        Field("Tug'ilgan sana", "birth_date", resolve=as_date), Field("Manzil", "address"), Field("Izoh", "notes"),
    ]
    bulk_actions = [
        Bulk("status", "Holatini o'zgartirish", lambda e, *, actor, status: services.employee_update(e, actor=actor,
                                                                                                     status=status),
             params=[{"name": "status", "label": "Holat", "options": opts(EmployeeStatus)}]),
        Bulk("delete", "O'chirish", services.employee_delete, action=Action.DELETE, danger=True),
    ]

    def get_queryset(self):
        return Employee.objects.select_related("user")

    @action(detail=False, methods=["get"])
    def departments(self, request):
        values = (Employee.objects.exclude(department="").order_by("department")
                  .values_list("department", flat=True).distinct())
        return Response(list(values))
