from decimal import Decimal
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from apps.chatter.services import diff, event, muted, post
from apps.core.exceptions import Conflict, ValidationFailed
from apps.projects.models import (
    EDITABLE_STATUSES,
    PRODUCTION_FIELDS,
    TRANSITIONS,
    Project,
    ProjectFile,
    ProjectItem,
    ProjectStatus,
)

# ------------------------------------------------------------------ order lines


def _lines_key(lines) -> list[tuple]:
    """Comparable form of lines, from model rows or validated dicts."""
    out = []
    for ln in lines:
        get = ln.get if isinstance(ln, dict) else lambda k, ln=ln: getattr(ln, k)
        out.append((get("product_type").pk, Decimal(get("area_m2")).normalize(), int(get("quantity"))))
    return sorted(out)


def _lines_text(lines) -> str:
    rows = [f"{ln.product_type.name} {ln.area_m2.normalize():f} m² × {ln.quantity}" for ln in lines]
    return "; ".join(rows) or "—"


def _set_items(project: Project, items: list[dict], *, actor) -> None:
    before = list(project.items.select_related("product_type"))
    if _lines_key(before) == _lines_key(items):
        return
    project.items.all().delete()
    ProjectItem.objects.bulk_create(ProjectItem(project=project, **it) for it in items)
    after = list(project.items.select_related("product_type"))
    post(project, kind="track", actor=actor,
         changes=[{"field": "items", "label": "Buyumlar", "old": _lines_text(before), "new": _lines_text(after)}])


# ------------------------------------------------------------------ project


@transaction.atomic
def project_create(*, actor, items: list[dict] | None = None, **fields) -> Project:
    project = Project(**fields)
    project.stamp(actor, created=True)
    project.save()  # chatter: "Loyiha yaratildi"
    # LY-26-00042: the year helps people on the phone ("the order from last year")
    project.code = f"LY-{timezone.localdate():%y}-{project.pk:05d}"
    project.save(update_fields=["code"])
    if items:
        ProjectItem.objects.bulk_create(ProjectItem(project=project, **it) for it in items)
    return project


def _locked_changes(project: Project, fields: dict, items: list[dict] | None) -> list[str]:
    """Production fields this update would really change (the form sends unchanged values too)."""
    changed = []
    for f in PRODUCTION_FIELDS & fields.keys():
        new = fields[f]
        old = getattr(project, f)
        if (old.pk if hasattr(old, "pk") else old) != (new.pk if hasattr(new, "pk") else new):
            changed.append(f)
    if items is not None and _lines_key(project.items.all()) != _lines_key(items):
        changed.append("items")
    return changed


@transaction.atomic
def project_update(project: Project, *, actor, items: list[dict] | None = None, **fields) -> Project:
    if project.status not in EDITABLE_STATUSES:
        locked = _locked_changes(project, fields, items)
        if locked:
            labels = {**Project.TRACK, "items": "Buyumlar"}
            names = ", ".join(labels.get(f, f) for f in sorted(locked))
            raise Conflict(f"Loyiha «{ProjectStatus(project.status).label}» bosqichida — "
                           f"ishlab chiqarish ma'lumotlari qulflangan: {names}")
    for key, value in fields.items():
        setattr(project, key, value)
    project.stamp(actor)
    project.save()  # chatter tracks the changed fields
    if items is not None:
        _set_items(project, items, actor=actor)
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


# ------------------------------------------------------------------ drawings

ALLOWED_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".dwg", ".dxf", ".zip"}
MAX_FILE_BYTES = 25 * 1024 * 1024


def project_file_add(project: Project, *, actor, upload) -> ProjectFile:
    ext = Path(upload.name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise ValidationFailed(f"Fayl turi qabul qilinmaydi ({ext or '—'}). Ruxsat: PDF, rasm, DWG, DXF, ZIP",
                               field="file")
    if upload.size > MAX_FILE_BYTES:
        raise ValidationFailed("Fayl 25 MB dan katta", field="file")
    f = ProjectFile.objects.create(project=project, file=upload, name=Path(upload.name).name[:200],
                                   size=upload.size, uploaded_by=actor)
    event(project, f"Chizma yuklandi: {f.name}", actor=actor)
    return f


def project_file_delete(f: ProjectFile, *, actor) -> None:
    project, name = f.project, f.name
    f.file.delete(save=False)
    f.delete()
    event(project, f"Chizma o'chirildi: {name}", actor=actor)
