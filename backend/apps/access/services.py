from django.db import transaction

from apps.access.models import Role, RolePermission
from apps.access.registry import ALL_ACTIONS, PAGE_BY_KEY, PAGES, Action
from apps.chatter.services import post
from apps.core.exceptions import Conflict, ValidationFailed

PermissionMap = dict[str, list[str]]


def effective_permissions(user) -> PermissionMap:
    """Union of all the user's roles. Superuser gets every action on every page.

    Cached on the user object for the duration of the request.
    """
    cached = getattr(user, "_rombo_perms", None)
    if cached is not None:
        return cached

    if user.is_superuser:
        result = {p.key: [a.value for a in p.actions] for p in PAGES}
    else:
        granted: dict[str, set[str]] = {}
        rows = RolePermission.objects.filter(role__users=user).values(
            "page_key", "can_view", "can_create", "can_update", "can_delete"
        )
        for row in rows:
            page = PAGE_BY_KEY.get(row["page_key"])
            if page is None:
                continue  # stale row of a removed page
            bucket = granted.setdefault(page.key, set())
            bucket.update(a.value for a in page.actions if row[f"can_{a.value}"])
        result = {k: sorted(v) for k, v in granted.items() if v}

    user._rombo_perms = result
    return result


def has_permission(user, page_key: str, action: Action) -> bool:
    if not user or not user.is_authenticated:
        return False
    return action.value in effective_permissions(user).get(page_key, [])


# --- roles -----------------------------------------------------------------
def _set_permissions(role: Role, permissions: list[dict]) -> None:
    """Replace the whole matrix. Write implies view; unsupported actions are forced off."""
    rows = []
    for p in permissions:
        page = PAGE_BY_KEY.get(p["page_key"])
        if page is None:
            raise ValidationFailed(f"Noma'lum sahifa: {p['page_key']}", field="permissions")
        flags = {f"can_{a.value}": bool(p.get(f"can_{a.value}")) and a in page.actions for a in ALL_ACTIONS}
        if flags["can_create"] or flags["can_update"] or flags["can_delete"]:
            flags["can_view"] = True
        if any(flags.values()):
            rows.append(RolePermission(role=role, page_key=page.key, **flags))
    role.permissions.all().delete()
    RolePermission.objects.bulk_create(rows)


@transaction.atomic
def role_create(*, actor, name: str, description: str = "", permissions: list[dict] | None = None) -> Role:
    role = Role(name=name, description=description)
    role.stamp(actor, created=True)
    role.save()
    _set_permissions(role, permissions or [])
    return role


ACTION_LABELS = {"view": "Ko'rish", "create": "Yaratish", "update": "Tahrirlash", "delete": "O'chirish"}


def _matrix(role: Role) -> dict[str, str]:
    """{page_key: "Ko'rish, Yaratish"} — how the role's permissions read in history."""
    out = {}
    for p in RolePermission.objects.filter(role=role):  # not role.permissions: may be a stale prefetch
        on = [ACTION_LABELS[a.value] for a in ALL_ACTIONS if getattr(p, f"can_{a.value}")]
        if on:
            out[p.page_key] = ", ".join(on)
    return out


@transaction.atomic
def role_update(role: Role, *, actor, permissions: list[dict] | None = None, **fields) -> Role:
    for key, value in fields.items():
        setattr(role, key, value)
    role.stamp(actor)
    role.save()
    if permissions is not None:
        before = _matrix(role)
        _set_permissions(role, permissions)
        after = _matrix(role)
        changes = [
            {"field": k, "label": PAGE_BY_KEY[k].label if k in PAGE_BY_KEY else k,
             "old": before.get(k, "—"), "new": after.get(k, "—")}
            for k in [p.key for p in PAGES] if before.get(k) != after.get(k)
        ]
        if changes:
            post(role, "Ruxsatlar o'zgartirildi", kind="track", changes=changes, actor=actor)
    return role


def role_delete(role: Role, *, actor) -> None:
    if role.is_system:
        raise Conflict("Tizim rolini o'chirib bo'lmaydi")
    role.delete()
