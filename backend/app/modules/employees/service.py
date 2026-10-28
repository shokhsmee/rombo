from __future__ import annotations

from app.core.exceptions import Conflict
from app.modules.employees.models import Employee, EmployeeStatus
from app.modules.employees.repository import EmployeeRepository
from app.modules.employees.schemas import EmployeeCreate, EmployeeUpdate
from app.modules.users.service import UserService
from app.shared.schemas import ListParams
from app.shared.service import BaseService


class EmployeeService(BaseService[Employee, EmployeeRepository]):
    repo_class = EmployeeRepository

    def list(self, params: ListParams, *, status: EmployeeStatus | None = None, department: str | None = None):
        filters = []
        if status:
            filters.append(Employee.status == status)
        if department:
            filters.append(Employee.department == department)
        return self.repo.list(params, filters)

    def get(self, employee_id: int) -> Employee:
        return self.repo.get_or_404(employee_id)

    def ensure_exists(self, employee_id: int | None) -> None:
        """Public check for other modules (e.g. project manager)."""
        if employee_id is not None:
            self.repo.get_or_404(employee_id)

    def departments(self) -> list[str]:
        return self.repo.departments()

    def create(self, data: EmployeeCreate) -> Employee:
        self._check_user_link(data.user_id)
        emp = Employee(**data.model_dump(), code=self.repo.next_code("XD", 4))
        self._stamp(emp, created=True)
        self.repo.add(emp)
        return self.commit(emp)

    def update(self, employee_id: int, data: EmployeeUpdate) -> Employee:
        emp = self.repo.get_or_404(employee_id)
        if "user_id" in data.model_fields_set:
            self._check_user_link(data.user_id, exclude_id=emp.id)
        self._apply(emp, data)
        self._stamp(emp)
        return self.commit(emp)

    def delete(self, employee_id: int) -> None:
        emp = self.repo.get_or_404(employee_id)
        emp.user_id = None  # free the login so it can be linked to someone else
        self.repo.soft_delete(emp)
        self.commit()

    def _check_user_link(self, user_id: int | None, exclude_id: int | None = None) -> None:
        if user_id is None:
            return
        UserService(self.db).repo.get_or_404(user_id)
        if self.repo.exists(Employee.user_id == user_id, exclude_id=exclude_id):
            raise Conflict("Bu foydalanuvchi boshqa xodimga biriktirilgan", field="user_id")
