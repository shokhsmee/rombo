from rest_framework.permissions import BasePermission

from apps.access.registry import PAGE_BY_KEY, Action
from apps.access.services import has_permission

# DRF viewset action -> registry action
DEFAULT_ACTION_MAP = {
    "list": Action.VIEW,
    "retrieve": Action.VIEW,
    "create": Action.CREATE,
    "update": Action.UPDATE,
    "partial_update": Action.UPDATE,
    "destroy": Action.DELETE,
}


class PagePermission(BasePermission):
    """Checks `view.page_key` against the user's role matrix.

    Custom @action endpoints declare their action in `view.permission_action_map`,
    e.g. {"change_status": Action.UPDATE}. Unknown actions default to VIEW.
    """

    message = "Bu amal uchun ruxsat yo'q"

    def has_permission(self, request, view):
        page_key = getattr(view, "page_key", None)
        assert page_key in PAGE_BY_KEY, f"{type(view).__name__}.page_key is not in the registry"
        action_name = getattr(view, "action", None)
        action = getattr(view, "permission_action_map", {}).get(action_name) or DEFAULT_ACTION_MAP.get(
            action_name, Action.VIEW
        )
        return has_permission(request.user, page_key, action)


def page_required(page_key: str, action: Action = Action.VIEW) -> type[BasePermission]:
    """A second page an endpoint needs on top of its viewset's own, e.g. the client map also needs
    `clients` view: `@action(permission_classes=[*ServiceModelViewSet.permission_classes,
    page_required(Pages.CLIENTS)])`."""
    assert page_key in PAGE_BY_KEY, f"{page_key} is not in the registry"

    class _PageRequired(BasePermission):
        message = PagePermission.message

        def has_permission(self, request, view):
            return has_permission(request.user, page_key, action)

    _PageRequired.__name__ = f"PageRequired_{page_key}"
    return _PageRequired
