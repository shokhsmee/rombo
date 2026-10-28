from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import Field

from app.modules.access.service import effective_permissions
from app.modules.auth.dependencies import DB, CurrentUser
from app.modules.users.schemas import UserOut
from app.modules.users.service import UserService
from app.shared.schemas import Schema

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenOut(Schema):
    access_token: str
    token_type: str = "bearer"


class ChangePassword(Schema):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/login", response_model=TokenOut)
def login(db: DB, form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    _, token = UserService(db).authenticate(form.username, form.password)
    return TokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    user.permissions = effective_permissions(user)
    return user


@router.post("/change-password", status_code=204)
def change_password(db: DB, user: CurrentUser, body: ChangePassword):
    UserService(db, user.id).change_own_password(user, body.current_password, body.new_password)
