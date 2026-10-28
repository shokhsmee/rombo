from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.employees.models import Employee
from app.shared.models import AuditMixin, Base, IdMixin, SoftDeleteMixin


class ClientKind(StrEnum):
    INDIVIDUAL = "individual"  # jismoniy shaxs
    COMPANY = "company"        # yuridik shaxs
    DEALER = "dealer"          # diler / hamkor


class Client(IdMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "clients"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    kind: Mapped[ClientKind] = mapped_column(String(20), default=ClientKind.INDIVIDUAL, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    tin: Mapped[str | None] = mapped_column(String(20), index=True)  # STIR / INN
    contact_person: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(32), index=True)
    phone_extra: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    region: Mapped[str | None] = mapped_column(String(100), index=True)
    address: Mapped[str | None] = mapped_column(String(255))
    source: Mapped[str | None] = mapped_column(String(100))  # qayerdan kelgan: tavsiya, reklama...
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    manager_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id", ondelete="SET NULL"))
    manager: Mapped[Employee | None] = relationship(lazy="joined")
