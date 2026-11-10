"""OpenSpec inside the app: a copy of `openspec/` (SpecDocument, filled by `manage.py specs_sync`) and the fix
ideas people file from Claude or by hand (FixIdea). See openspec change `add-claude-mcp`."""

from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel


class DocKind(models.TextChoices):
    PROJECT = "project", "Loyiha konteksti"
    SPEC = "spec", "Spetsifikatsiya"
    CHANGE = "change", "Faol o'zgarish"
    ARCHIVED = "archived", "Arxiv"


class SpecDocument(models.Model):
    """One markdown file of `openspec/`. Read-only for users: the repo is the source of truth."""

    path = models.CharField(max_length=300, unique=True)  # relative to openspec/, forward slashes
    kind = models.CharField(max_length=10, choices=DocKind.choices, db_index=True)
    # capability for specs, change folder for changes ("2026-10-28-bootstrap-foundation" when archived)
    ref = models.CharField(max_length=150, blank=True, default="", db_index=True)
    title = models.CharField(max_length=300, blank=True, default="")
    content = models.TextField()
    sha256 = models.CharField(max_length=64)
    requirements = models.PositiveIntegerField(default=0)  # "### Requirement:" headings
    synced_at = models.DateTimeField()

    class Meta:
        ordering = ["kind", "ref", "path"]
        verbose_name = "Spetsifikatsiya hujjati"
        verbose_name_plural = "Spetsifikatsiya hujjatlari"

    def __str__(self) -> str:
        return self.path


class IdeaKind(models.TextChoices):
    FIX = "fix", "Tuzatish"
    IMPROVEMENT = "improvement", "Yaxshilash"
    FEATURE = "feature", "Yangi imkoniyat"


class IdeaPriority(models.TextChoices):
    LOW = "low", "Past"
    NORMAL = "normal", "O'rta"
    HIGH = "high", "Yuqori"


class IdeaStatus(models.TextChoices):
    NEW = "new", "Yangi"
    ACCEPTED = "accepted", "Qabul qilindi"
    DONE = "done", "Bajarildi"
    REJECTED = "rejected", "Rad etildi"


class IdeaSource(models.TextChoices):
    MCP = "mcp", "Claude (MCP)"
    MANUAL = "manual", "Qo'lda"


S = IdeaStatus

# Allowed moves. services.idea_change_status rejects anything else.
TRANSITIONS: dict[str, set[str]] = {
    S.NEW: {S.ACCEPTED, S.REJECTED},
    S.ACCEPTED: {S.DONE, S.REJECTED},
    S.REJECTED: {S.NEW},  # reopen
    S.DONE: set(),
}


class FixIdea(AuditModel, SoftDeleteModel):
    TRACK = {"title": "Sarlavha", "kind": "Turi", "capability": "Bo'lim", "priority": "Muhimlik",
             "status": "Holat", "change_id": "OpenSpec o'zgarish"}
    CHATTER_NAME = "Taklif"

    code = models.CharField(max_length=20, unique=True, null=True, editable=False)  # TK-0001
    title = models.CharField("Sarlavha", max_length=200)
    kind = models.CharField("Turi", max_length=20, choices=IdeaKind.choices, default=IdeaKind.FIX)
    capability = models.CharField("Bo'lim", max_length=100, blank=True, default="")  # openspec/specs/<cap>
    priority = models.CharField("Muhimlik", max_length=10, choices=IdeaPriority.choices,
                                default=IdeaPriority.NORMAL)
    problem = models.TextField("Muammo")
    proposal = models.TextField("Taklif", blank=True, default="")
    impact = models.TextField("Ta'sir", blank=True, default="")  # apps, tables, endpoints, pages
    status = models.CharField("Holat", max_length=10, choices=IdeaStatus.choices, default=IdeaStatus.NEW,
                              db_index=True)
    source = models.CharField(max_length=10, choices=IdeaSource.choices, default=IdeaSource.MANUAL)
    change_id = models.CharField("OpenSpec o'zgarish", max_length=100, blank=True, default="")
    resolution = models.TextField("Izoh", blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Taklif"
        verbose_name_plural = "Takliflar"

    def __str__(self) -> str:
        return f"{self.code or ''} {self.title}".strip()
