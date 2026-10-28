from django.conf import settings
from django.db import models


class Message(models.Model):
    """One line of a record's history: a note someone wrote, an event, or tracked field changes.

    `model` + `res_id` point at any record, e.g. "projects.project" / 21.
    """

    class Kind(models.TextChoices):
        NOTE = "note", "Izoh"
        EVENT = "event", "Hodisa"
        TRACK = "track", "O'zgarish"

    model = models.CharField(max_length=60)
    res_id = models.PositiveBigIntegerField()
    kind = models.CharField(max_length=6, choices=Kind.choices, default=Kind.EVENT)
    body = models.TextField(blank=True, default="")
    # [{"field": "status", "label": "Holat", "old": "Qoralama", "new": "Tasdiqlangan"}]
    changes = models.JSONField(default=list, blank=True)
    author = models.CharField(max_length=150, blank=True, default="")  # name snapshot; "" = system
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="+")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        indexes = [models.Index(fields=["model", "res_id", "-created_at"], name="chatter_record_idx")]
        verbose_name = "Tarix yozuvi"
        verbose_name_plural = "Tarix"

    def __str__(self):
        return f"{self.model}#{self.res_id}: {self.body[:40]}"
