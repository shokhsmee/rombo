from sqlalchemy import distinct, select

from app.modules.employees.models import Employee
from app.shared.repository import BaseRepository


class EmployeeRepository(BaseRepository[Employee]):
    model = Employee
    search_fields = (
        Employee.code, Employee.last_name, Employee.first_name, Employee.middle_name,
        Employee.phone, Employee.position, Employee.department,
    )
    sort_fields = {
        "code": Employee.code,
        "name": Employee.last_name,
        "department": Employee.department,
        "position": Employee.position,
        "hire_date": Employee.hire_date,
        "created_at": Employee.created_at,
    }
    default_sort = "name"
    not_found_msg = "Xodim topilmadi"

    def departments(self) -> list[str]:
        stmt = (select(distinct(Employee.department))
                .where(Employee.department.is_not(None), Employee.deleted_at.is_(None))
                .order_by(Employee.department))
        return list(self.db.scalars(stmt))
