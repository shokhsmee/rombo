from datetime import datetime

from pydantic import EmailStr, Field

from app.modules.access.schemas import PermissionMap
from app.shared.schemas import Schema


class RoleRef(Schema):
    id: int
    name: str


class UserBase(Schema):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._-]+$")
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    is_active: bool = True
    is_superuser: bool = False


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    role_ids: list[int] = []


class UserUpdate(Schema):
    username: str | None = Field(None, min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._-]+$")
    full_name: str | None = Field(None, min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None
    role_ids: list[int] | None = None


class PasswordReset(Schema):
    password: str = Field(min_length=8, max_length=128)


class UserListItem(Schema):
    id: int
    username: str
    full_name: str
    email: str | None
    phone: str | None
    is_active: bool
    is_superuser: bool
    last_login_at: datetime | None
    roles: list[RoleRef]


class UserOut(UserListItem):
    created_at: datetime
    updated_at: datetime
    permissions: PermissionMap = {}
