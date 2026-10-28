from pydantic import EmailStr, Field

from app.modules.clients.models import ClientKind
from app.shared.schemas import AuditOut, Ref, Schema


class ClientBase(Schema):
    kind: ClientKind = ClientKind.INDIVIDUAL
    name: str = Field(min_length=2, max_length=255)
    tin: str | None = Field(None, pattern=r"^\d{9,14}$")
    contact_person: str | None = None
    phone: str | None = None
    phone_extra: str | None = None
    email: EmailStr | None = None
    region: str | None = None
    address: str | None = None
    source: str | None = None
    notes: str | None = None
    is_active: bool = True
    manager_id: int | None = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(Schema):
    kind: ClientKind | None = None
    name: str | None = Field(None, min_length=2, max_length=255)
    tin: str | None = Field(None, pattern=r"^\d{9,14}$")
    contact_person: str | None = None
    phone: str | None = None
    phone_extra: str | None = None
    email: EmailStr | None = None
    region: str | None = None
    address: str | None = None
    source: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    manager_id: int | None = None


class ClientListItem(Schema):
    id: int
    code: str
    kind: ClientKind
    name: str
    tin: str | None
    contact_person: str | None
    phone: str | None
    region: str | None
    is_active: bool
    manager: Ref | None


class ClientOut(ClientListItem, AuditOut):
    phone_extra: str | None
    email: str | None
    address: str | None
    source: str | None
    notes: str | None
    manager_id: int | None
    projects_count: int = 0
