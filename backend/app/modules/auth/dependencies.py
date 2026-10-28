from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import Forbidden, Unauthorized
from app.core.security import decode_access_token
from app.modules.access.registry import PAGE_BY_KEY, Action
from app.modules.access.service import has_permission
from app.modules.users.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")

DB = Annotated[Session, Depends(get_db)]


def get_current_user(db: DB, token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise Unauthorized("Sessiya tugagan, qayta kiring") from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active or payload.get("tv") != user.token_version:
        raise Unauthorized("Sessiya tugagan, qayta kiring")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require(page_key: str, action: Action = Action.VIEW):
    """Route guard:  user: User = Depends(require(Pages.CLIENTS, Action.CREATE))"""
    assert page_key in PAGE_BY_KEY, f"unknown page {page_key}"

    def checker(user: CurrentUser) -> User:
        if not has_permission(user, page_key, action):
            raise Forbidden("Bu amal uchun ruxsat yo'q")
        return user

    return checker
