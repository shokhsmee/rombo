from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.clients.models import Client
from app.modules.employees.models import Employee
from app.shared.models import AuditMixin, Base, IdMixin, SoftDeleteMixin


class ProjectStatus(StrEnum):
    DRAFT = "draft"                    # Qoralama
    CONFIRMED = "confirmed"            # Tasdiqlangan (shartnoma)
    PROCUREMENT = "procurement"        # Xarid / ta'minot
    PRODUCTION = "production"          # Ishlab chiqarishda
    READY = "ready"                    # Tayyor
    DELIVERED = "delivered"            # Yetkazildi / o'rnatildi
    CLOSED = "closed"                  # Yopildi
    CANCELLED = "cancelled"            # Bekor qilindi


# Allowed moves. Anything else is rejected by ProjectService.change_status.
TRANSITIONS: dict[ProjectStatus, set[ProjectStatus]] = {
    ProjectStatus.DRAFT: {ProjectStatus.CONFIRMED, ProjectStatus.CANCELLED},
    ProjectStatus.CONFIRMED: {ProjectStatus.PROCUREMENT, ProjectStatus.PRODUCTION,
                              ProjectStatus.DRAFT, ProjectStatus.CANCELLED},
    ProjectStatus.PROCUREMENT: {ProjectStatus.PRODUCTION, ProjectStatus.CANCELLED},
    ProjectStatus.PRODUCTION: {ProjectStatus.READY},
    ProjectStatus.READY: {ProjectStatus.DELIVERED},
    ProjectStatus.DELIVERED: {ProjectStatus.CLOSED},
    ProjectStatus.CLOSED: set(),
    ProjectStatus.CANCELLED: {ProjectStatus.DRAFT},
}

# Header fields lock once the order is in the factory.
EDITABLE_STATUSES = {ProjectStatus.DRAFT, ProjectStatus.CONFIRMED}


class Currency(StrEnum):
    UZS = "UZS"
    USD = "USD"


class Project(IdMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "projects"

    code: Mapped[str] = mapped_column(String(24), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    status: Mapped[ProjectStatus] = mapped_column(String(20), default=ProjectStatus.DRAFT, index=True)

    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="RESTRICT"), index=True)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id", ondelete="SET NULL"), index=True)

    object_address: Mapped[str | None] = mapped_column(String(255))
    region: Mapped[str | None] = mapped_column(String(100))
    contract_number: Mapped[str | None] = mapped_column(String(50))
    contract_date: Mapped[date | None] = mapped_column(Date)
    deadline: Mapped[date | None] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    currency: Mapped[Currency] = mapped_column(String(3), default=Currency.UZS)
    notes: Mapped[str | None] = mapped_column(Text)

    client: Mapped[Client] = relationship(lazy="joined")
    manager: Mapped[Employee | None] = relationship(lazy="joined")
    history: Mapped[list["ProjectStatusLog"]] = relationship(
        back_populates="project", order_by="desc(ProjectStatusLog.id)", lazy="selectin"
    )


class ProjectStatusLog(IdMixin, Base):
    """Append-only. Answers "who moved this order to production, when and why"."""

    __tablename__ = "project_status_log"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    comment: Mapped[str | None] = mapped_column(Text)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="history")
    user = relationship("User", lazy="joined")
