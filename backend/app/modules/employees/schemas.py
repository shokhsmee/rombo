from datetime import date

from pydantic import EmailStr, Field

from app.modules.employees.models import EmployeeStatus
from app.shared.schemas import AuditOut, Schema


class LinkedUser(Schema):
    id: int
    username: str


class EmployeeBase(Schema):
    last_name: str = Field(min_length=1, max_length=100)
    first_name: str = Field(min_length=1, max_length=100)
    middle_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    department: str | None = None
    position: str | None = None
    hire_date: date | None = None
    birth_date: date | None = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    address: str | None = None
    notes: str | None = None
    user_id: int | None = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(Schema):
    last_name: str | None = Field(None, min_length=1, max_length=100)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    middle_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    department: str | None = None
    position: str | None = None
    hire_date: date | None = None
    birth_date: date | None = None
    status: EmployeeStatus | None = None
    address: str | None = None
    notes: str | None = None
    user_id: int | None = None


class EmployeeListItem(Schema):
    id: int
    code: str
    name: str
    last_name: str
    first_name: str
    middle_name: str | None
    phone: str | None
    department: str | None
    position: str | None
    status: EmployeeStatus
    hire_date: date | None
    user: LinkedUser | None


class EmployeeOut(EmployeeListItem, AuditOut):
    email: str | None
    birth_date: date | None
    address: str | None
    notes: str | None
    user_id: int | None
