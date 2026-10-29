from decimal import Decimal
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from apps.chatter.services import diff, event, muted, post
from apps.core.exceptions import Conflict, ValidationFailed
from apps.projects import extensions
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
    if project.calcs.exists():
        fields.pop("amount", None)  # derived from the hisob-kitob; see recompute_amount
    if extensions.derived_advance(project) is not None:
        fields.pop("advance_amount", None)  # derived from posted kassa payments; see recompute_advance
        fields.pop("advance_date", None)
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
    recompute_amount(project)  # the rate or currency may have changed
    recompute_advance(project)
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


# ------------------------------------------------------------------ hisob-kitob (calculations)


def _check_calc_editable(project: Project) -> None:
    # the calculation is the order's material list: it locks together with the other production fields
    if project.status not in EDITABLE_STATUSES:
        raise Conflict(f"Loyiha «{ProjectStatus(project.status).label}» bosqichida — hisob-kitob qulflangan")


def recompute_amount(project: Project) -> None:
    """With calculations, the order amount is their total (converted by the USD rate when currencies differ).
    Without a rate for a cross-currency order the amount is left as is; the card shows a warning."""
    calcs = list(project.calcs.prefetch_related("lines"))
    if not calcs:
        return
    currencies = {c.currency for c in calcs}
    if len(currencies) != 1:
        return
    calc_cur = currencies.pop()
    total = sum((c.total for c in calcs), Decimal("0"))
    rate = project.usd_rate
    if calc_cur == project.currency:
        amount = total
    elif calc_cur == "USD" and project.currency == "UZS" and rate:
        amount = (total * rate).quantize(Decimal("1"))
    elif calc_cur == "UZS" and project.currency == "USD" and rate:
        amount = (total / rate).quantize(Decimal("0.01"))
    else:
        return
    if amount != project.amount:
        project.amount = amount
        project.save(update_fields=["amount", "updated_at"])  # tracked: "Summa: … → …"


def recompute_advance(project: Project) -> None:
    """Once the Loyiha has a posted customer payment (kassa registers an advance source), the advance is
    the sum of those payments and its date the first one's; typed values are overwritten. With no payments
    nothing happens: the advance stays the number sales typed."""
    derived = extensions.derived_advance(project)
    if derived is None:
        return
    amount, date = derived["amount"], derived["date"]
    if (project.advance_amount, project.advance_date) != (amount, date):
        project.advance_amount, project.advance_date = amount, date
        project.save(update_fields=["advance_amount", "advance_date", "updated_at"])  # tracked: "Avans: … → …"


def _calc_total_change(project, calc, before: Decimal, *, actor) -> None:
    after = sum((ln.line_sum for ln in calc.lines.all()), Decimal("0"))
    if after != before:
        post(project, kind="track", actor=actor, changes=[{
            "field": f"calc_{calc.pk}", "label": f"Hisob-kitob ({calc.title})",
            "old": f"{before:f} {calc.currency}", "new": f"{after:f} {calc.currency}"}])


@transaction.atomic
def calc_create(project: Project, *, actor, price_list, calc_date=None, notes: str = ""):
    from apps.projects.models import ProjectCalc, ProjectCalcLine

    _check_calc_editable(project)
    calc = ProjectCalc(project=project, price_list=price_list, title=price_list.name,
                       bar_length_m=price_list.bar_length_m, currency=price_list.currency,
                       calc_date=calc_date or timezone.localdate(), notes=notes)
    calc.stamp(actor, created=True)
    calc.save()
    ProjectCalcLine.objects.bulk_create(
        ProjectCalcLine(calc=calc, item=it, sort_order=it.sort_order, name=it.name, unit=it.unit, price=it.price)
        for it in price_list.items.filter(is_active=True)
    )
    event(project, f"Hisob-kitob qo'shildi: {calc.title}", actor=actor)
    return calc


@transaction.atomic
def calc_update(calc, *, actor, lines: list[dict] | None = None, **fields):
    project = calc.project
    _check_calc_editable(project)
    before = calc.total
    for k, v in fields.items():
        setattr(calc, k, v)
    calc.stamp(actor)
    calc.save()
    if lines is not None:
        by_id = {ln.pk: ln for ln in calc.lines.all()}
        for row in lines:
            ln = by_id.get(row.get("id"))
            if ln is None:
                raise ValidationFailed("Hisob-kitobda bunday qator yo'q", field="lines")
            new_qty, new_price = row.get("qty", ln.qty), row.get("price", ln.price)
            if (new_qty, new_price) != (ln.qty, ln.price):
                ln.qty, ln.price = new_qty, new_price
                ln.save(update_fields=["qty", "price"])
    calc = type(calc).objects.prefetch_related("lines").get(pk=calc.pk)
    _calc_total_change(project, calc, before, actor=actor)
    recompute_amount(project)
    return calc


@transaction.atomic
def calc_refresh_prices(calc, *, actor):
    """Re-read current price-list prices (on purpose, never automatically)."""
    project = calc.project
    _check_calc_editable(project)
    before = calc.total
    changed = 0
    for ln in calc.lines.select_related("item"):
        if ln.item and ln.item.price != ln.price:
            ln.price = ln.item.price
            ln.save(update_fields=["price"])
            changed += 1
    calc = type(calc).objects.prefetch_related("lines").get(pk=calc.pk)
    event(project, f"Hisob-kitob narxlari yangilandi ({calc.title}): {changed} qator", actor=actor)
    _calc_total_change(project, calc, before, actor=actor)
    recompute_amount(project)
    return calc


@transaction.atomic
def calc_delete(calc, *, actor) -> None:
    project = calc.project
    _check_calc_editable(project)
    title = calc.title
    calc.delete()
    event(project, f"Hisob-kitob o'chirildi: {title}", actor=actor)
    recompute_amount(project)
