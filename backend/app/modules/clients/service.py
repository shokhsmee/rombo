from __future__ import annotations

from sqlalchemy import func, select

from app.core.exceptions import Conflict
from app.modules.clients.models import Client, ClientKind
from app.modules.clients.repository import ClientRepository
from app.modules.clients.schemas import ClientCreate, ClientUpdate
from app.modules.employees.service import EmployeeService
from app.shared.schemas import ListParams
from app.shared.service import BaseService


class ClientService(BaseService[Client, ClientRepository]):
    repo_class = ClientRepository

    def list(self, params: ListParams, *, kind: ClientKind | None = None, region: str | None = None,
             is_active: bool | None = None, manager_id: int | None = None):
        filters = []
        if kind:
            filters.append(Client.kind == kind)
        if region:
            filters.append(Client.region == region)
        if is_active is not None:
            filters.append(Client.is_active.is_(is_active))
        if manager_id:
            filters.append(Client.manager_id == manager_id)
        return self.repo.list(params, filters)

    def get(self, client_id: int) -> Client:
        client = self.repo.get_or_404(client_id)
        # Imported lazily: projects depends on clients, not the other way round.
        from app.modules.projects.models import Project

        client.projects_count = self.db.scalar(
            select(func.count()).where(Project.client_id == client.id, Project.deleted_at.is_(None))
        )
        return client

    def ensure_exists(self, client_id: int) -> None:
        self.repo.get_or_404(client_id)

    def create(self, data: ClientCreate) -> Client:
        self._check(data.tin, data.manager_id)
        client = Client(**data.model_dump(), code=self.repo.next_code("MJ"))
        self._stamp(client, created=True)
        self.repo.add(client)
        self.commit(client)
        return self.get(client.id)

    def update(self, client_id: int, data: ClientUpdate) -> Client:
        client = self.repo.get_or_404(client_id)
        self._check(data.tin, data.manager_id, exclude_id=client.id)
        self._apply(client, data)
        self._stamp(client)
        self.commit(client)
        return self.get(client.id)

    def delete(self, client_id: int) -> None:
        client = self.get(client_id)
        if client.projects_count:
            raise Conflict("Mijozda loyihalar bor — o'chirish o'rniga nofaol qiling")
        self.repo.soft_delete(client)
        self.commit()

    def _check(self, tin: str | None, manager_id: int | None, exclude_id: int | None = None) -> None:
        if tin and self.repo.exists(Client.tin == tin, exclude_id=exclude_id):
            raise Conflict("Bu STIR bilan mijoz mavjud", field="tin")
        EmployeeService(self.db).ensure_exists(manager_id)
