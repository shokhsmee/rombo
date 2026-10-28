from django.contrib import admin

from apps.employees.models import Employee


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["code", "last_name", "first_name", "department", "position", "status"]
    list_filter = ["status", "department"]
    search_fields = ["code", "last_name", "first_name", "phone"]
