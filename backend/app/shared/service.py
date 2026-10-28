from typing import Any, Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.shared.models import AuditMixin, Base
from app.shared.repository import BaseRepository

M = TypeVar("M", bound=Base)
R = TypeVar("R", bound=BaseRepository)


class BaseService(Generic[M, R]):
    """Business rules + transaction boundary.

    Rules of thumb:
      * Routers call services, never repositories.
      * A public service method == one unit of work == one commit.
      * Cross-module calls go service -> service (never into another module's repository).
    """

    repo_class: type[R]

    def __init__(self, db: Session, actor_id: int | None = None):
        self.db = db
        self.actor_id = actor_id
        self.repo: R = self.repo_class(db)

    def _stamp(self, obj: Any, *, created: bool = False) -> None:
        if isinstance(obj, AuditMixin):
            if created:
                obj.created_by_id = self.actor_id
            obj.updated_by_id = self.actor_id

    @staticmethod
    def _apply(obj: Any, data: BaseModel, *, exclude: set[str] | None = None) -> None:
        """Copy only fields the client actually sent (PATCH semantics)."""
        for key, value in data.model_dump(exclude_unset=True, exclude=exclude or set()).items():
            setattr(obj, key, value)

    def commit(self, obj: M | None = None) -> M | None:
        self.db.commit()
        if obj is not None:
            self.db.refresh(obj)
        return obj
