from django.db import transaction

from apps.core.exceptions import Conflict
from apps.core.models import assign_code
from apps.employees.models import Employee


def _check_user_link(user, exclude_id: int | None = None) -> None:
    if user is None:
        return
    qs = Employee.all_objects.filter(user=user)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    if qs.exists():
        raise Conflict("Bu foydalanuvchi boshqa xodimga biriktirilgan", field="user_id")


@transaction.atomic
def employee_create(*, actor, **fields) -> Employee:
    _check_user_link(fields.get("user"))
    emp = Employee(**fields)
    emp.stamp(actor, created=True)
    emp.save()
    assign_code(emp, "XD", 4)
    return emp


@transaction.atomic
def employee_update(emp: Employee, *, actor, **fields) -> Employee:
    if "user" in fields:
        _check_user_link(fields["user"], exclude_id=emp.pk)
    for key, value in fields.items():
        setattr(emp, key, value)
    emp.stamp(actor)
    emp.save()
    return emp


@transaction.atomic
def employee_delete(emp: Employee, *, actor) -> None:
    emp.user = None  # free the login so it can be linked to someone else
    emp.stamp(actor)
    emp.save(update_fields=["user", "updated_by", "updated_at"])
    emp.soft_delete()
