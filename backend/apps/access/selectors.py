from django.db.models import Count, QuerySet

from apps.access.models import Role


def role_queryset() -> QuerySet[Role]:
    return Role.objects.annotate(users_count=Count("users", distinct=True)).prefetch_related("permissions")
