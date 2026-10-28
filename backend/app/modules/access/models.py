from sqlalchemy import Boolean, Column, ForeignKey, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import AuditMixin, Base, IdMixin

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class Role(IdMixin, AuditMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)  # seeded roles can't be deleted

    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan", lazy="selectin"
    )


class RolePermission(IdMixin, Base):
    """One row per (role, page). Missing row == no access at all."""

    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "page_key"),)

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), index=True)
    page_key: Mapped[str] = mapped_column(String(64))
    can_view: Mapped[bool] = mapped_column(Boolean, default=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False)
    can_update: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)

    role: Mapped[Role] = relationship(back_populates="permissions")
