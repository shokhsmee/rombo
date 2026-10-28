import django_filters
from rest_framework import status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.access.registry import Action, Pages
from apps.core.views import ServiceModelViewSet
from apps.users import services
from apps.users.authentication import LoginSerializer, RefreshSerializer
from apps.users.models import User
from apps.users.selectors import user_queryset
from apps.users.serializers import (
    ChangePasswordSerializer,
    MeSerializer,
    PasswordSerializer,
    UserListSerializer,
    UserSerializer,
)


# --- auth ------------------------------------------------------------------
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class RefreshView(TokenRefreshView):
    serializer_class = RefreshSerializer


@api_view(["GET"])
def me_view(request):
    return Response(MeSerializer(request.user).data)


@api_view(["POST"])
def change_password_view(request):
    s = ChangePasswordSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    services.user_change_own_password(request.user, **s.validated_data)
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- users CRUD ------------------------------------------------------------
class UserFilter(django_filters.FilterSet):
    role = django_filters.NumberFilter(field_name="roles__id")

    class Meta:
        model = User
        fields = ["is_active", "is_superuser", "role"]


class UserViewSet(ServiceModelViewSet):
    page_key = Pages.USERS
    serializer_class = UserSerializer
    list_serializer_class = UserListSerializer
    filterset_class = UserFilter
    search_fields = ["username", "first_name", "last_name", "email", "phone"]
    ordering_fields = ["username", "first_name", "last_login", "date_joined"]
    ordering = ["first_name", "username"]
    permission_action_map = {"reset_password": Action.UPDATE}

    service_create = services.user_create
    service_update = services.user_update
    service_delete = services.user_delete

    def get_queryset(self):
        return user_queryset().select_related("employee")

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        s = PasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.user_set_password(self.get_object(), actor=request.user, **s.validated_data)
        return Response(status=status.HTTP_204_NO_CONTENT)
