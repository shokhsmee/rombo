from datetime import date, datetime
from decimal import Decimal

from pydantic import Field

from app.modules.projects.models import Currency, ProjectStatus
from app.shared.schemas import AuditOut, Ref, Schema


class ProjectBase(Schema):
    name: str = Field(min_length=2, max_length=255)
    client_id: int
    manager_id: int | None = None
    object_address: str | None = None
    region: str | None = None
    contract_number: str | None = None
    contract_date: date | None = None
    deadline: date | None = None
    amount: Decimal = Field(Decimal("0"), ge=0)
    currency: Currency = Currency.UZS
    notes: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(Schema):
    name: str | None = Field(None, min_length=2, max_length=255)
    client_id: int | None = None
    manager_id: int | None = None
    object_address: str | None = None
    region: str | None = None
    contract_number: str | None = None
    contract_date: date | None = None
    deadline: date | None = None
    amount: Decimal | None = Field(None, ge=0)
    currency: Currency | None = None
    notes: str | None = None


class StatusChange(Schema):
    status: ProjectStatus
    comment: str | None = None


class UserRef(Schema):
    id: int
    full_name: str


class StatusLogOut(Schema):
    id: int
    from_status: str | None
    to_status: str
    comment: str | None
    created_at: datetime
    user: UserRef | None


class ProjectListItem(Schema):
    id: int
    code: str
    name: str
    status: ProjectStatus
    client: Ref
    manager: Ref | None
    region: str | None
    deadline: date | None
    amount: Decimal
    currency: Currency
    created_at: datetime


class ProjectOut(ProjectListItem, AuditOut):
    client_id: int
    manager_id: int | None
    object_address: str | None
    contract_number: str | None
    contract_date: date | None
    notes: str | None
    allowed_statuses: list[ProjectStatus] = []
    history: list[StatusLogOut] = []


class StatusSummary(Schema):
    status: ProjectStatus
    count: int
