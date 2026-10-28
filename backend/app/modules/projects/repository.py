from datetime import date

from sqlalchemy import func, select

from app.modules.clients.models import Client
from app.modules.projects.models import Project
from app.shared.repository import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    model = Project
    # Client name/phone are searchable too: sales usually look up an order by customer.
    search_fields = (Project.code, Project.name, Project.contract_number, Project.object_address,
                     Client.name, Client.phone)
    sort_fields = {
        "code": Project.code,
        "name": Project.name,
        "deadline": Project.deadline,
        "amount": Project.amount,
        "status": Project.status,
        "created_at": Project.created_at,
    }
    default_sort = "-created_at"
    not_found_msg = "Loyiha topilmadi"

    def base_query(self):
        return super().base_query().join(Project.client)

    def next_project_code(self) -> str:
        """LY-26-00042 — year prefix helps people on the phone: 'the order from last year'."""
        last = self.db.scalar(select(func.max(Project.id))) or 0
        return f"LY-{date.today():%y}-{last + 1:05d}"

    def count_by_status(self) -> list[tuple[str, int]]:
        stmt = (select(Project.status, func.count())
                .where(Project.deleted_at.is_(None))
                .group_by(Project.status))
        return list(self.db.execute(stmt).all())
