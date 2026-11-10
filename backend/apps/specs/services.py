import hashlib
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from apps.chatter.models import Message
from apps.chatter.services import post
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.models import assign_code
from apps.specs import openspec
from apps.specs.models import TRANSITIONS, FixIdea, IdeaSource, IdeaStatus, SpecDocument

# --------------------------------------------------------------------------- spec sync


@transaction.atomic
def specs_sync(root: Path) -> dict[str, int]:
    """Make SpecDocument match the markdown files under `root` (the repo's `openspec/`)."""
    if not root.is_dir() or not (root / "specs").is_dir():
        raise ValidationFailed(f"OpenSpec papkasi topilmadi: {root}")
    now = timezone.now()
    tree = openspec.read_tree(root)
    existing = {d.path: d for d in SpecDocument.objects.all()}
    stats = {"created": 0, "updated": 0, "unchanged": 0, "deleted": 0}
    for path, text in tree.items():
        kind_ref = openspec.classify(path)
        if kind_ref is None:
            continue
        kind, ref = kind_ref
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        fields = dict(kind=kind, ref=ref, title=openspec.title_of(text, path), content=text, sha256=digest,
                      requirements=len(openspec.requirements(text)), synced_at=now)
        doc = existing.pop(path, None)
        if doc is None:
            SpecDocument.objects.create(path=path, **fields)
            stats["created"] += 1
        elif doc.sha256 != digest or doc.kind != kind or doc.ref != ref:
            for key, value in fields.items():
                setattr(doc, key, value)
            doc.save()
            stats["updated"] += 1
        else:
            stats["unchanged"] += 1
    if existing:
        SpecDocument.objects.filter(pk__in=[d.pk for d in existing.values()]).delete()
        stats["deleted"] = len(existing)
    return stats


# --------------------------------------------------------------------------- fix ideas
EDITABLE_FIELDS = {"title", "kind", "capability", "priority", "problem", "proposal", "impact", "change_id",
                   "resolution"}


def _clean(fields: dict) -> dict:
    if "title" in fields:
        fields["title"] = (fields["title"] or "").strip()
        if len(fields["title"]) < 3:
            raise ValidationFailed("Sarlavha kamida 3 ta belgi", field="title")
    if "problem" in fields and not (fields["problem"] or "").strip():
        raise ValidationFailed("Muammoni yozing", field="problem")
    if fields.get("capability"):
        fields["capability"] = fields["capability"].strip().lower()
    return fields


@transaction.atomic
def idea_create(*, actor, source: str = IdeaSource.MANUAL, **fields) -> FixIdea:
    unknown = set(fields) - EDITABLE_FIELDS
    assert not unknown, f"not editable here: {unknown}"
    idea = FixIdea(source=source, **_clean(fields))
    idea.stamp(actor, created=True)
    idea.save()
    assign_code(idea, "TK", width=4)
    return idea


@transaction.atomic
def idea_update(idea: FixIdea, *, actor, **fields) -> FixIdea:
    unknown = set(fields) - EDITABLE_FIELDS
    assert not unknown, f"not editable here: {unknown}"
    if idea.status == IdeaStatus.DONE:
        raise Conflict("Bajarilgan taklifni o'zgartirib bo'lmaydi")
    for key, value in _clean(fields).items():
        setattr(idea, key, value)
    idea.stamp(actor)
    idea.save()
    return idea


@transaction.atomic
def idea_change_status(idea: FixIdea, *, actor, status: str, comment: str = "") -> FixIdea:
    if status not in TRANSITIONS.get(idea.status, set()):
        raise Conflict(f"'{idea.get_status_display()}' holatidan '{IdeaStatus(status).label}' ga o'tib bo'lmaydi",
                       field="status")
    if status == IdeaStatus.REJECTED and not comment.strip():
        raise ValidationFailed("Rad etish sababini yozing", field="comment")
    idea.status = status
    if comment.strip():
        idea.resolution = comment.strip()
    idea.stamp(actor)
    idea.save()
    if comment.strip():
        post(idea, comment.strip()[:4000], kind=Message.Kind.NOTE, actor=actor)
    return idea


def idea_delete(idea: FixIdea, *, actor) -> None:
    if idea.status != IdeaStatus.NEW:
        raise Conflict("Faqat yangi taklifni o'chirish mumkin — boshqasini rad eting")
    idea.soft_delete()
