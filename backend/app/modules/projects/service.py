from __future__ import annotations

from datetime import date

from app.core.exceptions import Conflict, ValidationFailed
from app.modules.clients.service import ClientService
from app.modules.employees.service import EmployeeService
from app.modules.projects.models import (
    EDITABLE_STATUSES,
    TRANSITIONS,
    Project,
    ProjectStatus,
    ProjectStatusLog,
)
from app.modules.projects.repository import ProjectRepository
from app.modules.projects.schemas import ProjectCreate, ProjectUpdate, StatusChange
from app.shared.schemas import ListParams
from app.shared.service import BaseService


class ProjectService(BaseService[Project, ProjectRepository]):
    repo_class = ProjectRepository

    def list(self, params: ListParams, *, status: list[ProjectStatus] | None = None,
             client_id: int | None = None, manager_id: int | None = None, overdue: bool = False):
        filters = []
        if status:
            filters.append(Project.status.in_(status))
        if client_id:
            filters.append(Project.client_id == client_id)
        if manager_id:
            filters.append(Project.manager_id == manager_id)
        if overdue:
            filters.append(Project.deadline < date.today())
            filters.append(Project.status.not_in([ProjectStatus.DELIVERED, ProjectStatus.CLOSED,
                                                  ProjectStatus.CANCELLED]))
        return self.repo.list(params, filters)

    def get(self, project_id: int) -> Project:
        project = self.repo.get_or_404(project_id)
        project.allowed_statuses = sorted(TRANSITIONS[ProjectStatus(project.status)])
        return project

    def summary(self):
        return [{"status": s, "count": c} for s, c in self.repo.count_by_status()]

    def create(self, data: ProjectCreate) -> Project:
        self._check_refs(data.client_id, data.manager_id)
        project = Project(**data.model_dump(), code=self.repo.next_project_code())
        self._stamp(project, created=True)
        self.repo.add(project)
        self.db.add(ProjectStatusLog(project_id=project.id, from_status=None,
                                     to_status=ProjectStatus.DRAFT, user_id=self.actor_id,
                                     comment="Loyiha yaratildi"))
        self.commit(project)
        return self.get(project.id)

    def update(self, project_id: int, data: ProjectUpdate) -> Project:
        project = self.repo.get_or_404(project_id)
        if project.status not in EDITABLE_STATUSES:
            # Locked once in procurement/production: a silent change here breaks the material plan.
            raise Conflict("Loyiha ishlab chiqarish bosqichida — asosiy ma'lumotlarni o'zgartirib bo'lmaydi")
        self._check_refs(data.client_id, data.manager_id)
        self._apply(project, data)
        self._stamp(project)
        self.commit(project)
        return self.get(project.id)

    def change_status(self, project_id: int, body: StatusChange) -> Project:
        project = self.repo.get_or_404(project_id)
        current = ProjectStatus(project.status)
        if body.status not in TRANSITIONS[current]:
            raise ValidationFailed(f"'{current}' holatidan '{body.status}' holatiga o'tib bo'lmaydi",
                                   field="status")
        if body.status == ProjectStatus.CANCELLED and not body.comment:
            raise ValidationFailed("Bekor qilish sababini yozing", field="comment")
        project.status = body.status
        self._stamp(project)
        self.db.add(ProjectStatusLog(project_id=project.id, from_status=current, to_status=body.status,
                                     comment=body.comment, user_id=self.actor_id))
        self.commit(project)
        self.db.expire(project, ["history"])
        return self.get(project.id)

    def delete(self, project_id: int) -> None:
        project = self.repo.get_or_404(project_id)
        if project.status != ProjectStatus.DRAFT:
            raise Conflict("Faqat qoralama loyihani o'chirish mumkin. Boshqalarini bekor qiling.")
        self.repo.soft_delete(project)
        self.commit()

    def _check_refs(self, client_id: int | None, manager_id: int | None) -> None:
        if client_id is not None:
            ClientService(self.db).ensure_exists(client_id)
        EmployeeService(self.db).ensure_exists(manager_id)
