from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class AuditOut(Schema):
    created_at: datetime
    updated_at: datetime
    created_by_id: int | None = None
    updated_by_id: int | None = None


class ListParams(BaseModel):
    """Common query params for every list endpoint: ?q=&page=&size=&sort=-created_at"""

    q: str | None = None
    page: int = Field(1, ge=1)
    size: int = Field(25, ge=1, le=200)
    sort: str | None = None


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int


class Ref(Schema):
    """Compact reference to another record, used inside other payloads (e.g. project.client)."""

    id: int
    code: str | None = None
    name: str
