from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.access.registry import Action, Pages
from app.modules.auth.dependencies import DB, require
from app.modules.employees.models import EmployeeStatus
from app.modules.employees.schemas import EmployeeCreate, EmployeeListItem, EmployeeOut, EmployeeUpdate
from app.modules.employees.service import EmployeeService
from app.modules.users.models import User
from app.shared.schemas import ListParams, Page

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=Page[EmployeeListItem])
def list_employees(db: DB, params: Annotated[ListParams, Depends()],
                   status: EmployeeStatus | None = None, department: str | None = None,
                   _: User = Depends(require(Pages.EMPLOYEES))):
    items, total = EmployeeService(db).list(params, status=status, department=department)
    return Page(items=items, total=total, page=params.page, size=params.size)


@router.get("/departments", response_model=list[str])
def list_departments(db: DB, _: User = Depends(require(Pages.EMPLOYEES))):
    return EmployeeService(db).departments()


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, db: DB, _: User = Depends(require(Pages.EMPLOYEES))):
    return EmployeeService(db).get(employee_id)


@router.post("", response_model=EmployeeOut, status_code=201)
def create_employee(body: EmployeeCreate, db: DB,
                    actor: User = Depends(require(Pages.EMPLOYEES, Action.CREATE))):
    return EmployeeService(db, actor.id).create(body)


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, body: EmployeeUpdate, db: DB,
                    actor: User = Depends(require(Pages.EMPLOYEES, Action.UPDATE))):
    return EmployeeService(db, actor.id).update(employee_id, body)


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: DB,
                    actor: User = Depends(require(Pages.EMPLOYEES, Action.DELETE))):
    EmployeeService(db, actor.id).delete(employee_id)
