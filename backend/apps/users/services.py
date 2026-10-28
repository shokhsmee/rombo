from django.db import transaction

from apps.chatter.services import event, post
from apps.core.exceptions import Conflict, ValidationFailed
from apps.users.models import User


@transaction.atomic
def user_create(*, actor, password: str, roles=None, **fields) -> User:
    user = User(**fields)
    user.set_password(password)
    user.save()
    if roles is not None:
        user.roles.set(roles)
    return user


@transaction.atomic
def user_update(user: User, *, actor, roles=None, password: str | None = None, **fields) -> User:
    if user.pk == actor.pk and (fields.get("is_active") is False or fields.get("is_superuser") is False):
        raise Conflict("O'zingizni bloklash yoki superuser huquqini olib tashlash mumkin emas")

    was_active = user.is_active
    for key, value in fields.items():
        setattr(user, key, value)
    if was_active and not user.is_active:
        user.revoke_tokens()  # kick active sessions immediately
    if password:
        user.set_password(password)
        user.revoke_tokens()
    user.save()
    if roles is not None:
        before = ", ".join(sorted(r.name for r in user.roles.all())) or "—"
        user.roles.set(roles)
        after = ", ".join(sorted(r.name for r in roles)) or "—"
        if before != after:
            post(user, kind="track", actor=actor,
                 changes=[{"field": "roles", "label": "Rollar", "old": before, "new": after}])
    if password:
        event(user, "Parol o'zgartirildi", actor=actor)
    return user


def user_delete(user: User, *, actor) -> None:
    # Users are referenced by audit columns everywhere — deactivate instead of deleting.
    raise Conflict("Foydalanuvchini o'chirib bo'lmaydi — uni bloklang")


def user_set_password(user: User, *, actor, password: str) -> None:
    user.set_password(password)
    user.revoke_tokens()
    user.save(update_fields=["password", "token_version"])
    event(user, "Parol tiklandi — barcha qurilmalardan chiqarildi", actor=actor)


def user_change_own_password(user: User, *, current_password: str, new_password: str) -> None:
    if not user.check_password(current_password):
        raise ValidationFailed("Joriy parol noto'g'ri", field="current_password")
    user_set_password(user, actor=user, password=new_password)
