from __future__ import annotations

from app.core.exceptions import Conflict, ValidationFailed
from app.modules.access.models import Role, RolePermission
from app.modules.access.registry import PAGE_BY_KEY, PAGES, Action
from app.modules.access.repository import RoleRepository
from app.modules.access.schemas import PermissionIn, PermissionMap, RoleCreate, RoleUpdate
from app.shared.schemas import ListParams
from app.shared.service import BaseService


def effective_permissions(user) -> PermissionMap:
    """Union of all the user's roles. Superuser gets every action on every page."""
    if user.is_superuser:
        return {p.key: [a.value for a in p.actions] for p in PAGES}

    result: dict[str, set[str]] = {}
    for role in user.roles:
        for perm in role.permissions:
            page = PAGE_BY_KEY.get(perm.page_key)
            if page is None:
                continue  # stale row for a removed page
            granted = result.setdefault(perm.page_key, set())
            for action in page.actions:
                if getattr(perm, f"can_{action.value}"):
                    granted.add(action.value)
    return {k: sorted(v) for k, v in result.items() if v}


def has_permission(user, page_key: str, action: Action) -> bool:
    return action.value in effective_permissions(user).get(page_key, [])


class RoleService(BaseService[Role, RoleRepository]):
    repo_class = RoleRepository

    def list(self, params: ListParams):
        items, total = self.repo.list(params)
        counts = self.repo.users_count([r.id for r in items])
        for r in items:
            r.users_count = counts.get(r.id, 0)
        return items, total

    def get(self, role_id: int) -> Role:
        role = self.repo.get_or_404(role_id)
        role.users_count = self.repo.users_count([role.id]).get(role.id, 0)
        return role

    def create(self, data: RoleCreate) -> Role:
        self._ensure_unique_name(data.name)
        role = Role(name=data.name, description=data.description)
        self._stamp(role, created=True)
        self._set_permissions(role, data.permissions)
        self.repo.add(role)
        return self.commit(role)

    def update(self, role_id: int, data: RoleUpdate) -> Role:
        role = self.repo.get_or_404(role_id)
        if data.name is not None:
            self._ensure_unique_name(data.name, exclude_id=role.id)
        self._apply(role, data, exclude={"permissions"})
        if data.permissions is not None:
            self._set_permissions(role, data.permissions)
        self._stamp(role)
        self.commit(role)
        return self.get(role.id)

    def delete(self, role_id: int) -> None:
        role = self.repo.get_or_404(role_id)
        if role.is_system:
            raise Conflict("Tizim rolini o'chirib bo'lmaydi")
        self.repo.soft_delete(role)
        self.commit()

    # --- internals ------------------------------------------------------
    def _ensure_unique_name(self, name: str, exclude_id: int | None = None) -> None:
        existing = self.repo.by_name(name)
        if existing and existing.id != exclude_id:
            raise Conflict("Bunday nomli rol mavjud", field="name")

    @staticmethod
    def _set_permissions(role: Role, perms: list[PermissionIn]) -> None:
        """Replace the whole matrix. Actions a page doesn't support are forced off."""
        rows: list[RolePermission] = []
        for p in perms:
            page = PAGE_BY_KEY.get(p.page_key)
            if page is None:
                raise ValidationFailed(f"Noma'lum sahifa: {p.page_key}", field="permissions")
            flags = {f"can_{a.value}": getattr(p, f"can_{a.value}") and a in page.actions for a in Action}
            if any(flags.values()):
                rows.append(RolePermission(page_key=p.page_key, **flags))
        role.permissions = rows
