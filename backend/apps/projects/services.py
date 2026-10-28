from django.db import transaction
from django.utils import timezone

from apps.chatter.services import diff, muted, post
from apps.core.exceptions import Conflict, ValidationFailed
from apps.projects.models import EDITABLE_STATUSES, TRANSITIONS, Project, ProjectStatus


@transaction.atomic
def project_create(*, actor, **fields) -> Project:
    project = Project(**fields)
    project.stamp(actor, created=True)
    project.save()  # chatter: "Loyiha yaratildi"
    # LY-26-00042: the year helps people on the phone ("the order from last year")
    project.code = f"LY-{timezone.localdate():%y}-{project.pk:05d}"
    project.save(update_fields=["code"])
    return project


@transaction.atomic
def project_update(project: Project, *, actor, **fields) -> Project:
    if project.status not in EDITABLE_STATUSES:
        raise Conflict("Loyiha xarid/ishlab chiqarish bosqichida — asosiy ma'lumotlarni o'zgartirib bo'lmaydi")
    for key, value in fields.items():
        setattr(project, key, value)
    project.stamp(actor)
    project.save()  # chatter tracks the changed fields
    return project


@transaction.atomic
def project_change_status(project: Project, *, actor, status: str, comment: str = "") -> Project:
    # lock the row: two managers clicking at once must not both pass the transition check
    project = Project.objects.select_for_update().get(pk=project.pk)
    current = project.status
    if status not in TRANSITIONS[current]:
        raise ValidationFailed(
            f"'{ProjectStatus(current).label}' holatidan '{ProjectStatus(status).label}' holatiga o'tib bo'lmaydi",
            field="status",
        )
    comment = comment.strip()
    if status == ProjectStatus.CANCELLED and not comment:
        raise ValidationFailed("Bekor qilish sababini yozing", field="comment")

    before = {"status": current}
    project.status = status
    project.stamp(actor)
    with muted():  # one history line with the comment, not a bare tracked change + a separate note
        project.save(update_fields=["status", "updated_by", "updated_at"])
    post(project, comment, kind="track", changes=diff(project, before, {"status": "Holat"}), actor=actor)
    return project


def project_delete(project: Project, *, actor) -> None:
    if project.status != ProjectStatus.DRAFT:
        raise Conflict("Faqat qoralama loyihani o'chirish mumkin. Boshqalarini bekor qiling.")
    project.soft_delete()
