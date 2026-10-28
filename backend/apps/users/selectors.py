from django.db.models import QuerySet

from apps.users.models import User


def user_queryset() -> QuerySet[User]:
    return User.objects.prefetch_related("roles")
