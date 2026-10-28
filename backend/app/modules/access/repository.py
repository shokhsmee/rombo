from sqlalchemy import func, select

from app.modules.access.models import Role, user_roles
from app.shared.repository import BaseRepository


class RoleRepository(BaseRepository[Role]):
    model = Role
    search_fields = (Role.name, Role.description)
    sort_fields = {"name": Role.name, "created_at": Role.created_at}
    default_sort = "name"
    not_found_msg = "Rol topilmadi"

    def by_ids(self, ids: list[int]) -> list[Role]:
        if not ids:
            return []
        return list(self.db.scalars(select(Role).where(Role.id.in_(ids))))

    def by_name(self, name: str) -> Role | None:
        return self.db.scalar(select(Role).where(func.lower(Role.name) == name.lower()))

    def users_count(self, role_ids: list[int]) -> dict[int, int]:
        rows = self.db.execute(
            select(user_roles.c.role_id, func.count())
            .where(user_roles.c.role_id.in_(role_ids))
            .group_by(user_roles.c.role_id)
        )
        return dict(rows.all())
