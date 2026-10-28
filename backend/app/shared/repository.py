from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, Generic, TypeVar

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFound
from app.shared.models import Base, SoftDeleteMixin
from app.shared.schemas import ListParams

M = TypeVar("M", bound=Base)


class BaseRepository(Generic[M]):
    """Data access only — no business rules, no permission checks, no commits.

    Subclasses declare:
      model          — the ORM class
      search_fields  — columns matched by ?q= (case-insensitive LIKE)
      sort_fields    — whitelist of sortable columns (name -> column)
      not_found_msg  — message for NotFound
    """

    model: type[M]
    search_fields: Sequence[Any] = ()
    sort_fields: dict[str, Any] = {}
    default_sort: str = "-id"
    not_found_msg = "Yozuv topilmadi"

    def __init__(self, db: Session):
        self.db = db

    # --- query building -------------------------------------------------
    def base_query(self) -> Select:
        stmt = select(self.model)
        if issubclass(self.model, SoftDeleteMixin):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        return stmt

    def apply_search(self, stmt: Select, q: str | None) -> Select:
        if not q or not self.search_fields:
            return stmt
        terms = [t for t in q.strip().split() if t]
        # every word must match at least one field: "akfa toshkent" narrows, not widens
        for term in terms:
            like = f"%{term.lower()}%"
            stmt = stmt.where(or_(*[func.lower(f).like(like) for f in self.search_fields]))
        return stmt

    def apply_sort(self, stmt: Select, sort: str | None) -> Select:
        key = sort or self.default_sort
        desc = key.startswith("-")
        col = self.sort_fields.get(key.lstrip("-"), self.model.id)
        return stmt.order_by(col.desc() if desc else col.asc(), self.model.id.desc())

    # --- reads ----------------------------------------------------------
    def get(self, id_: int) -> M | None:
        return self.db.scalar(self.base_query().where(self.model.id == id_))

    def get_or_404(self, id_: int) -> M:
        obj = self.get(id_)
        if obj is None:
            raise NotFound(self.not_found_msg)
        return obj

    def list(
        self, params: ListParams, filters: Sequence[ColumnElement[bool]] = ()
    ) -> tuple[list[M], int]:
        stmt = self.apply_search(self.base_query(), params.q)
        for f in filters:
            stmt = stmt.where(f)
        total = self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        stmt = self.apply_sort(stmt, params.sort).offset((params.page - 1) * params.size).limit(params.size)
        return list(self.db.scalars(stmt).unique()), total

    def exists(self, *conditions: ColumnElement[bool], exclude_id: int | None = None) -> bool:
        stmt = self.base_query().where(*conditions)
        if exclude_id is not None:
            stmt = stmt.where(self.model.id != exclude_id)
        return self.db.scalar(select(func.count()).select_from(stmt.subquery())) > 0

    # --- writes (flush only; the service owns the transaction) ----------
    def add(self, obj: M) -> M:
        self.db.add(obj)
        self.db.flush()
        return obj

    def soft_delete(self, obj: M) -> None:
        if isinstance(obj, SoftDeleteMixin):
            obj.deleted_at = datetime.now(UTC)
        else:
            self.db.delete(obj)
        self.db.flush()

    def next_code(self, prefix: str, width: int = 5) -> str:
        """Sequential human codes like CL-00012. Counts soft-deleted rows too so codes never repeat."""
        last = self.db.scalar(select(func.max(self.model.id))) or 0
        return f"{prefix}-{last + 1:0{width}d}"
