from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditModel(TimeStampedModel):
    """Who created / last changed the row. Filled by services from `actor`, never by the client."""

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        abstract = True

    def stamp(self, actor, *, created: bool = False) -> None:
        if created:
            self.created_by = actor
        self.updated_by = actor


class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class SoftDeleteModel(models.Model):
    """Business records are archived, not erased: orders and invoices reference them for years.

    `objects` hides archived rows; `all_objects` sees everything (reports, admin restores).
    """

    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True, editable=False)

    objects = ActiveManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def soft_delete(self) -> None:
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at"])


def assign_code(obj: models.Model, prefix: str, width: int = 5) -> None:
    """Human code from the primary key (MJ-00012). Race-free: call right after the first save."""
    obj.code = f"{prefix}-{obj.pk:0{width}d}"
    obj.save(update_fields=["code"])
