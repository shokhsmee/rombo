from datetime import date
from enum import StrEnum

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.users.models import User
from app.shared.models import AuditMixin, Base, IdMixin, SoftDeleteMixin


class EmployeeStatus(StrEnum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    DISMISSED = "dismissed"


class Employee(IdMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "employees"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    last_name: Mapped[str] = mapped_column(String(100), index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    middle_name: Mapped[str | None] = mapped_column(String(100))

    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(120), index=True)
    position: Mapped[str | None] = mapped_column(String(120))
    hire_date: Mapped[date | None] = mapped_column(Date)
    birth_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[EmployeeStatus] = mapped_column(String(20), default=EmployeeStatus.ACTIVE, index=True)
    address: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    user: Mapped[User | None] = relationship(foreign_keys=[user_id], lazy="joined")

    @property
    def name(self) -> str:
        """Display name — used by `Ref` payloads everywhere an employee is referenced."""
        return " ".join(p for p in (self.last_name, self.first_name) if p)
