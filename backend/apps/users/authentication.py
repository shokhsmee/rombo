from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User

TOKEN_VERSION_CLAIM = "tv"


class VersionedJWTAuthentication(JWTAuthentication):
    """Standard JWT auth + token_version check, so blocking a user logs them out everywhere."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if validated_token.get(TOKEN_VERSION_CLAIM) != user.token_version:
            raise AuthenticationFailed("Sessiya tugagan, qayta kiring", code="token_revoked")
        return user


class LoginSerializer(TokenObtainPairSerializer):
    default_error_messages = {"no_active_account": "Login yoki parol noto'g'ri"}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token[TOKEN_VERSION_CLAIM] = user.token_version
        return token


class RefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user = User.objects.filter(pk=refresh.get("user_id"), is_active=True).first()
        if user is None or refresh.get(TOKEN_VERSION_CLAIM) != user.token_version:
            raise AuthenticationFailed("Sessiya tugagan, qayta kiring", code="token_revoked")
        return super().validate(attrs)
