from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.access.registry import Action, Pages
from app.modules.auth.dependencies import DB, require
from app.modules.users.models import User
from app.modules.users.schemas import PasswordReset, UserCreate, UserListItem, UserOut, UserUpdate
from app.modules.users.service import UserService
from app.shared.schemas import ListParams, Page

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=Page[UserListItem])
def list_users(db: DB, params: Annotated[ListParams, Depends()],
               is_active: bool | None = None, role_id: int | None = None,
               _: User = Depends(require(Pages.USERS))):
    items, total = UserService(db).list(params, is_active=is_active, role_id=role_id)
    return Page(items=items, total=total, page=params.page, size=params.size)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: DB, _: User = Depends(require(Pages.USERS))):
    return UserService(db).get(user_id)


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: DB, actor: User = Depends(require(Pages.USERS, Action.CREATE))):
    return UserService(db, actor.id).create(body)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, db: DB,
                actor: User = Depends(require(Pages.USERS, Action.UPDATE))):
    return UserService(db, actor.id).update(user_id, body)


@router.post("/{user_id}/reset-password", status_code=204)
def reset_password(user_id: int, body: PasswordReset, db: DB,
                   actor: User = Depends(require(Pages.USERS, Action.UPDATE))):
    UserService(db, actor.id).reset_password(user_id, body.password)
