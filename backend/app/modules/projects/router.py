from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.modules.access.registry import Action, Pages
from app.modules.auth.dependencies import DB, require
from app.modules.projects.models import ProjectStatus
from app.modules.projects.schemas import (
    ProjectCreate,
    ProjectListItem,
    ProjectOut,
    ProjectUpdate,
    StatusChange,
    StatusSummary,
)
from app.modules.projects.service import ProjectService
from app.modules.users.models import User
from app.shared.schemas import ListParams, Page

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=Page[ProjectListItem])
def list_projects(db: DB, params: Annotated[ListParams, Depends()],
                  status: Annotated[list[ProjectStatus] | None, Query()] = None,
                  client_id: int | None = None, manager_id: int | None = None, overdue: bool = False,
                  _: User = Depends(require(Pages.PROJECTS))):
    items, total = ProjectService(db).list(params, status=status, client_id=client_id,
                                           manager_id=manager_id, overdue=overdue)
    return Page(items=items, total=total, page=params.page, size=params.size)


@router.get("/summary", response_model=list[StatusSummary])
def projects_summary(db: DB, _: User = Depends(require(Pages.PROJECTS))):
    return ProjectService(db).summary()


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: DB, _: User = Depends(require(Pages.PROJECTS))):
    return ProjectService(db).get(project_id)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: DB,
                   actor: User = Depends(require(Pages.PROJECTS, Action.CREATE))):
    return ProjectService(db, actor.id).create(body)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, body: ProjectUpdate, db: DB,
                   actor: User = Depends(require(Pages.PROJECTS, Action.UPDATE))):
    return ProjectService(db, actor.id).update(project_id, body)


@router.post("/{project_id}/status", response_model=ProjectOut)
def change_project_status(project_id: int, body: StatusChange, db: DB,
                          actor: User = Depends(require(Pages.PROJECTS, Action.UPDATE))):
    return ProjectService(db, actor.id).change_status(project_id, body)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: DB, actor: User = Depends(require(Pages.PROJECTS, Action.DELETE))):
    ProjectService(db, actor.id).delete(project_id)
