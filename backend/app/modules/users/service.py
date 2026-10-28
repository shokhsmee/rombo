from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func

from app.core.exceptions import Conflict, Forbidden, Unauthorized, ValidationFailed
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.access.repository import RoleRepository
from app.modules.access.service import effective_permissions
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import UserCreate, UserUpdate
from app.shared.schemas import ListParams
from app.shared.service import BaseService


class UserService(BaseService[User, UserRepository]):
    repo_class = UserRepository

    # --- auth -----------------------------------------------------------
    def authenticate(self, username: str, password: str) -> tuple[User, str]:
        user = self.repo.by_username(username)
        # same message for unknown user and wrong password: don't leak which usernames exist
        if user is None or not verify_password(password, user.password_hash):
            raise Unauthorized("Login yoki parol noto'g'ri")
        if not user.is_active:
            raise Forbidden("Foydalanuvchi bloklangan")
        user.last_login_at = datetime.now(UTC)
        self.commit(user)
        return user, create_access_token(user.id, user.token_version)

    def change_own_password(self, user: User, current: str, new: str) -> None:
        if not verify_password(current, user.password_hash):
            raise ValidationFailed("Joriy parol noto'g'ri", field="current_password")
        user.password_hash = hash_password(new)
        user.token_version += 1
        self.commit(user)

    # --- CRUD -----------------------------------------------------------
    def list(self, params: ListParams, *, is_active: bool | None = None, role_id: int | None = None):
        filters = []
        if is_active is not None:
            filters.append(User.is_active.is_(is_active))
        if role_id is not None:
            filters.append(User.roles.any(id=role_id))
        return self.repo.list(params, filters)

    def get(self, user_id: int) -> User:
        user = self.repo.get_or_404(user_id)
        user.permissions = effective_permissions(user)
        return user

    def create(self, data: UserCreate) -> User:
        self._ensure_unique(data.username, data.email)
        user = User(
            **data.model_dump(exclude={"password", "role_ids"}),
            password_hash=hash_password(data.password),
        )
        user.roles = RoleRepository(self.db).by_ids(data.role_ids)
        self.repo.add(user)
        self.commit(user)
        return self.get(user.id)

    def update(self, user_id: int, data: UserUpdate) -> User:
        user = self.repo.get_or_404(user_id)
        self._ensure_unique(data.username, data.email, exclude_id=user.id)
        if user.id == self.actor_id and (data.is_active is False or data.is_superuser is False):
            raise Conflict("O'zingizni bloklash yoki superuser huquqini olib tashlash mumkin emas")
        self._apply(user, data, exclude={"role_ids"})
        if data.role_ids is not None:
            user.roles = RoleRepository(self.db).by_ids(data.role_ids)
        if data.is_active is False:
            user.token_version += 1  # kick active sessions immediately
        self.commit(user)
        return self.get(user.id)

    def reset_password(self, user_id: int, password: str) -> None:
        user = self.repo.get_or_404(user_id)
        user.password_hash = hash_password(password)
        user.token_version += 1
        self.commit()

    def _ensure_unique(self, username: str | None, email: str | None, exclude_id: int | None = None):
        if username and self.repo.exists(func.lower(User.username) == username.lower(), exclude_id=exclude_id):
            raise Conflict("Bu login band", field="username")
        if email and self.repo.exists(func.lower(User.email) == email.lower(), exclude_id=exclude_id):
            raise Conflict("Bu email band", field="email")
