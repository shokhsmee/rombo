from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.access.registry import PAGES, Action, Pages
from app.modules.access.schemas import PageOut, RoleCreate, RoleListItem, RoleOut, RoleUpdate
from app.modules.access.service import RoleService
from app.modules.auth.dependencies import DB, CurrentUser, require
from app.modules.users.models import User
from app.shared.schemas import ListParams, Page

router = APIRouter(prefix="/access", tags=["access"])


@router.get("/pages", response_model=list[PageOut])
def list_pages(_: CurrentUser):
    return [PageOut(key=p.key, label=p.label, group=p.group, actions=list(p.actions), planned=p.planned)
            for p in PAGES]


@router.get("/roles", response_model=Page[RoleListItem])
def list_roles(db: DB, params: Annotated[ListParams, Depends()],
               _: User = Depends(require(Pages.ROLES))):
    items, total = RoleService(db).list(params)
    return Page(items=items, total=total, page=params.page, size=params.size)


@router.get("/roles/{role_id}", response_model=RoleOut)
def get_role(role_id: int, db: DB, _: User = Depends(require(Pages.ROLES))):
    return RoleService(db).get(role_id)


@router.post("/roles", response_model=RoleOut, status_code=201)
def create_role(body: RoleCreate, db: DB, user: User = Depends(require(Pages.ROLES, Action.CREATE))):
    svc = RoleService(db, user.id)
    return svc.get(svc.create(body).id)


@router.patch("/roles/{role_id}", response_model=RoleOut)
def update_role(role_id: int, body: RoleUpdate, db: DB,
                user: User = Depends(require(Pages.ROLES, Action.UPDATE))):
    return RoleService(db, user.id).update(role_id, body)


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(role_id: int, db: DB, user: User = Depends(require(Pages.ROLES, Action.DELETE))):
    RoleService(db, user.id).delete(role_id)
