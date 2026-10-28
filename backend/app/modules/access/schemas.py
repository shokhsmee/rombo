from pydantic import Field, model_validator

from app.shared.schemas import AuditOut, Schema


class PageOut(Schema):
    key: str
    label: str
    group: str
    actions: list[str]
    planned: bool


class PermissionIn(Schema):
    page_key: str
    can_view: bool = False
    can_create: bool = False
    can_update: bool = False
    can_delete: bool = False

    @model_validator(mode="after")
    def write_implies_view(self):
        # Creating/editing something you can't open makes no sense in the UI.
        if self.can_create or self.can_update or self.can_delete:
            self.can_view = True
        return self


class PermissionOut(PermissionIn):
    pass


class RoleBase(Schema):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None


class RoleCreate(RoleBase):
    permissions: list[PermissionIn] = []


class RoleUpdate(Schema):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    permissions: list[PermissionIn] | None = None


class RoleListItem(Schema):
    id: int
    name: str
    description: str | None
    is_system: bool
    users_count: int = 0


class RoleOut(RoleListItem, AuditOut):
    permissions: list[PermissionOut]


# Effective permissions of the current user: {"clients": ["view","create"], ...}
PermissionMap = dict[str, list[str]]
