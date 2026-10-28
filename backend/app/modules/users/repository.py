from sqlalchemy import func, select

from app.modules.users.models import User
from app.shared.repository import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User
    search_fields = (User.username, User.full_name, User.email, User.phone)
    sort_fields = {
        "username": User.username,
        "full_name": User.full_name,
        "last_login_at": User.last_login_at,
        "created_at": User.created_at,
    }
    default_sort = "full_name"
    not_found_msg = "Foydalanuvchi topilmadi"

    def by_username(self, username: str) -> User | None:
        return self.db.scalar(select(User).where(func.lower(User.username) == username.lower()))
