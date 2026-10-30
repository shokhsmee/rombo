from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access.permissions import page_required
from apps.access.registry import Pages
from apps.dashboard import selectors


@api_view(["GET"])
@permission_classes([IsAuthenticated, page_required(Pages.DASHBOARD)])
def dashboard_view(request):
    """Sections of Bosh sahifa the user may see (each needs view on its module's page)."""
    return Response(selectors.dashboard(request.user))
